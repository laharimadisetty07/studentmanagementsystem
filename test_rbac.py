import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"

def api_call(method, path, body=None, headers=None):
    if headers is None:
        headers = {}
    url = f"{BASE_URL}{path}"
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            content_type = response.headers.get("content-type", "")
            resp_body = response.read()
            json_data = None
            if "application/json" in content_type:
                json_data = json.loads(resp_body.decode("utf-8"))
            return status_code, json_data, resp_body, response.headers
    except urllib.error.HTTPError as e:
        status_code = e.code
        err_body = e.read()
        json_data = None
        try:
            json_data = json.loads(err_body.decode("utf-8"))
        except Exception:
            pass
        return status_code, json_data, err_body, e.headers

def log_test(test_name, passed, detail=""):
    mark = "✅ PASS" if passed else "❌ FAIL"
    print(f"{mark} | {test_name} {f'({detail})' if detail else ''}")
    if not passed:
        raise AssertionError(f"Test failed: {test_name} - {detail}")

def test_login(username, password):
    status, data, _, _ = api_call("POST", "/auth/login", {"username": username, "password": password})
    assert status == 200, f"Login failed for {username}: {status} {data}"
    assert "access_token" in data
    return data["access_token"], data["user"]

def run_tests():
    print("========================================")
    print("RUNNING COMPREHENSIVE RBAC TEST SUITE")
    print("========================================")

    # 1. Test Admin Login
    admin_token, admin_user = test_login("admin", "admin123")
    log_test("Admin Login", admin_user["role"] == "admin", f"Role: {admin_user['role']}")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Test Faculty Login
    faculty_token, faculty_user = test_login("faculty", "faculty123")
    log_test("Faculty CS Login", faculty_user["role"] == "faculty", f"Role: {faculty_user['role']}, Dept: {faculty_user['department']}")
    faculty_headers = {"Authorization": f"Bearer {faculty_token}"}

    # 3. Test Student Login (rahul)
    student_token, student_user = test_login("rahul", "student123")
    log_test("Student Rahul Login", student_user["role"] == "student" and student_user["student_id"] is not None, f"Student ID: {student_user['student_id']}")
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 4. Data Preservation check
    status, all_students, _, _ = api_call("GET", "/students", headers=admin_headers)
    assert status == 200
    student_names = [s["name"] for s in all_students]
    log_test("Data Preservation Check", len(all_students) >= 4 and "Rahul Sharma" in student_names, f"Total Students: {len(all_students)}, Names: {student_names}")

    rahul_id = student_user["student_id"]
    # Find another student id
    other_student = next(s for s in all_students if s["id"] != rahul_id)
    other_id = other_student["id"]
    print(f"Testing Rahul (ID={rahul_id}) vs Other Student {other_student['name']} (ID={other_id})")

    # 5. Student Isolation: Rahul can access his own profile
    status, data, _, _ = api_call("GET", f"/students/{rahul_id}/profile", headers=student_headers)
    log_test("Student Access Own Profile", status == 200, f"HTTP {status}")

    # 6. Student Isolation: Rahul CANNOT access another student's profile (403 Forbidden)
    status, data, _, _ = api_call("GET", f"/students/{other_id}/profile", headers=student_headers)
    log_test("Student Blocked From Other Profile (403)", status == 403, f"HTTP {status}")

    # 7. Student Isolation: Rahul CANNOT access another student's report.pdf (403 Forbidden)
    status, _, _, _ = api_call("GET", f"/students/{other_id}/report.pdf", headers=student_headers)
    log_test("Student Blocked From Other PDF Report (403)", status == 403, f"HTTP {status}")

    # 8. Student Isolation: Rahul can download his own report.pdf (200 OK)
    status, _, body, hdrs = api_call("GET", f"/students/{rahul_id}/report.pdf", headers=student_headers)
    is_pdf = hdrs.get("content-type") == "application/pdf"
    log_test("Student Can Download Own PDF Report (200)", status == 200 and is_pdf, f"HTTP {status}")

    # 9. Student Isolation: Rahul CANNOT query another student's attendance via /students/{id}/attendance
    status, _, _, _ = api_call("GET", f"/students/{other_id}/attendance", headers=student_headers)
    log_test("Student Blocked From Other Attendance (403)", status == 403, f"HTTP {status}")

    # 10. Student Isolation: Rahul can query his own attendance
    status, _, _, _ = api_call("GET", f"/students/{rahul_id}/attendance", headers=student_headers)
    log_test("Student Can Access Own Attendance (200)", status == 200, f"HTTP {status}")

    # 11. Student Isolation: Rahul CANNOT query another student's marks via /students/{id}/marks
    status, _, _, _ = api_call("GET", f"/students/{other_id}/marks", headers=student_headers)
    log_test("Student Blocked From Other Marks (403)", status == 403, f"HTTP {status}")

    # 12. Student Isolation: Rahul can query his own marks
    status, _, _, _ = api_call("GET", f"/students/{rahul_id}/marks", headers=student_headers)
    log_test("Student Can Access Own Marks (200)", status == 200, f"HTTP {status}")

    # 13. Student Mutation Blocked: Rahul CANNOT add attendance (403 Forbidden)
    status, _, _, _ = api_call("POST", "/attendance", {
        "student_id": rahul_id,
        "date": "2026-10-13",
        "status": "Present"
    }, headers=student_headers)
    log_test("Student Blocked From Adding Attendance (403)", status == 403, f"HTTP {status}")

    # 14. Student Mutation Blocked: Rahul CANNOT add marks (403 Forbidden)
    status, _, _, _ = api_call("POST", "/marks", {
        "student_id": rahul_id,
        "subject": "Math",
        "marks_obtained": 95,
        "max_marks": 100,
        "semester": 1
    }, headers=student_headers)
    log_test("Student Blocked From Adding Marks (403)", status == 403, f"HTTP {status}")

    # 15. Student Mutation Blocked: Rahul CANNOT create student (403 Forbidden)
    status, _, _, _ = api_call("POST", "/students", {
        "name": "Hacker",
        "email": "hacker@test.com",
        "department": "Computer Science",
        "year": 1
    }, headers=student_headers)
    log_test("Student Blocked From Creating Student (403)", status == 403, f"HTTP {status}")

    # 16. Faculty Permissions: Faculty can record attendance
    status, _, _, _ = api_call("POST", "/attendance", {
        "student_id": rahul_id,
        "date": "2026-10-13",
        "status": "Present",
        "remarks": "RBAC Automated Test"
    }, headers=faculty_headers)
    log_test("Faculty Can Record Attendance (200/201)", status in (200, 201), f"HTTP {status}")

    # 17. Faculty Permissions: Faculty CANNOT delete or create student records (403 Forbidden - Admin only)
    status, _, _, _ = api_call("POST", "/students", {
        "name": "Faculty Student",
        "email": "facultystudent@test.com",
        "department": "Computer Science",
        "year": 1
    }, headers=faculty_headers)
    log_test("Faculty Blocked From Adding Student (403)", status == 403, f"HTTP {status}")

    # 18. Admin Full CRUD: Admin can create and delete a temporary test student
    status, new_st, _, _ = api_call("POST", "/students", {
        "name": "RBAC Temp Student",
        "email": "temp_rbac_test@test.edu",
        "department": "Computer Science",
        "year": 2,
        "phone": "+1-555-0199"
    }, headers=admin_headers)
    log_test("Admin Can Create Student (201)", status == 201, f"HTTP {status}")
    temp_id = new_st["id"]

    status, _, _, _ = api_call("DELETE", f"/students/{temp_id}", headers=admin_headers)
    log_test("Admin Can Delete Student (200)", status == 200, f"HTTP {status}")

    # 19. Unauthenticated requests are rejected (401 Unauthorized)
    status, _, _, _ = api_call("GET", "/students/1/profile")
    log_test("Unauthenticated Blocked (401)", status == 401, f"HTTP {status}")

    # 20. Formal Report Card PDF: Rahul can download his own report card
    status, _, body, hdrs = api_call("GET", f"/students/{rahul_id}/report-card.pdf", headers=student_headers)
    is_pdf = hdrs.get("content-type") == "application/pdf"
    log_test("Student Can Download Own Report Card PDF (200)", status == 200 and is_pdf, f"HTTP {status}")

    # 21. Formal Report Card PDF: Rahul CANNOT download another student's report card (403 Forbidden)
    status, _, _, _ = api_call("GET", f"/students/{other_id}/report-card.pdf", headers=student_headers)
    log_test("Student Blocked From Other Report Card PDF (403)", status == 403, f"HTTP {status}")

    # 22. Admin Dashboard: Accessible to Admin, Blocked for Student (403)
    status, admin_dash, _, _ = api_call("GET", "/dashboard/admin", headers=admin_headers)
    log_test("Admin Dashboard Access (200)", status == 200 and "total_students" in admin_dash, f"HTTP {status}")

    status, _, _, _ = api_call("GET", "/dashboard/admin", headers=student_headers)
    log_test("Student Blocked From Admin Dashboard (403)", status == 403, f"HTTP {status}")

    # 23. Faculty Dashboard: Accessible to Faculty, Blocked for Student (403)
    status, fac_dash, _, _ = api_call("GET", "/dashboard/faculty", headers=faculty_headers)
    log_test("Faculty Dashboard Access (200)", status == 200 and "department" in fac_dash, f"HTTP {status}")

    status, _, _, _ = api_call("GET", "/dashboard/faculty", headers=student_headers)
    log_test("Student Blocked From Faculty Dashboard (403)", status == 403, f"HTTP {status}")

    # 24. Student Dashboard: Accessible to Rahul (200)
    status, stud_dash, _, _ = api_call("GET", "/dashboard/student", headers=student_headers)
    log_test("Student Dashboard Access (200)", status == 200 and "overall_attendance_pct" in stud_dash, f"HTTP {status}")

    # 25. Timetable: Student receives scoped timetable, Student blocked from adding (403)
    status, tt_list, _, _ = api_call("GET", "/timetables", headers=student_headers)
    log_test("Student Timetable Query (200)", status == 200 and isinstance(tt_list, list), f"HTTP {status}, Count={len(tt_list)}")

    status, _, _, _ = api_call("POST", "/timetables", {
        "department": "Computer Science",
        "year": 1,
        "day_of_week": "Monday",
        "start_time": "08:00 AM",
        "end_time": "09:00 AM",
        "subject": "Hacked Class",
        "faculty_name": "Hacker",
        "room": "101"
    }, headers=student_headers)
    log_test("Student Blocked From Adding Timetable (403)", status == 403, f"HTTP {status}")

    # 26. Exam Schedules: Queryable, Student blocked from adding (403)
    status, ex_list, _, _ = api_call("GET", "/exams", headers=student_headers)
    log_test("Student Exam Schedule Query (200)", status == 200 and isinstance(ex_list, list), f"HTTP {status}, Count={len(ex_list)}")

    status, _, _, _ = api_call("POST", "/exams", {
        "department": "Computer Science",
        "year": 1,
        "semester": "Semester 1",
        "subject": "Hacked Exam",
        "exam_date": "2026-12-01",
        "start_time": "09:00 AM",
        "end_time": "12:00 PM",
        "room": "Hall 1",
        "max_marks": 100.0
    }, headers=student_headers)
    log_test("Student Blocked From Adding Exam (403)", status == 403, f"HTTP {status}")

    # 27. Announcements: Queryable, Student blocked from posting (403), Admin can post (201)
    status, ann_list, _, _ = api_call("GET", "/announcements", headers=student_headers)
    log_test("Student Announcements Query (200)", status == 200 and isinstance(ann_list, list), f"HTTP {status}, Count={len(ann_list)}")

    status, _, _, _ = api_call("POST", "/announcements", {
        "title": "Student Fake Notice",
        "content": "Fake content",
        "category": "General",
        "target_role": "all"
    }, headers=student_headers)
    log_test("Student Blocked From Posting Notice (403)", status == 403, f"HTTP {status}")

    # 28. Audit Logs: Strictly Admin only (200), Faculty and Student blocked (403)
    status, logs_data, _, _ = api_call("GET", "/audit-logs", headers=admin_headers)
    log_test("Admin Can View Audit Logs (200)", status == 200 and isinstance(logs_data, list), f"HTTP {status}, Log Count={len(logs_data)}")

    status, _, _, _ = api_call("GET", "/audit-logs", headers=faculty_headers)
    log_test("Faculty Blocked From Audit Logs (403)", status == 403, f"HTTP {status}")

    status, _, _, _ = api_call("GET", "/audit-logs", headers=student_headers)
    log_test("Student Blocked From Audit Logs (403)", status == 403, f"HTTP {status}")

    # 29. Verify Audit Trail captured actions
    entity_types_in_logs = set(l["entity_type"] for l in logs_data)
    log_test("Audit Trail Captured Entities", len(entity_types_in_logs) > 0, f"Logged Entities: {entity_types_in_logs}")

    print("========================================")
    print("ALL 29 RBAC & NEW MODULE TESTS PASSED! 🎉")
    print("========================================")


if __name__ == "__main__":
    run_tests()

