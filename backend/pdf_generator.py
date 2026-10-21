import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch


def generate_student_report_pdf(student, attendance_summary, attendance_records, academic_summary, marks_records) -> io.BytesIO:
    """
    Generates a comprehensive PDF report for a student including
    demographics, attendance statistics, and academic marks transcript.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1e1b4b"),
        alignment=1,  # Center
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#4f46e5"),
        alignment=1,
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#312e81"),
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1f2937"),
    )
    meta_style = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#6b7280"),
        alignment=1,
    )

    elements = []

    # ── Header ──
    elements.append(Paragraph("STUDENT MANAGEMENT SYSTEM", title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("OFFICIAL STUDENT PROFILE, ATTENDANCE & ACADEMIC REPORT", subtitle_style))
    elements.append(Spacer(1, 4))
    elements.append(
        Paragraph(
            f"Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
            meta_style,
        )
    )
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#4f46e5"), spaceAfter=14))

    # ── 1. Student Details Section ──
    elements.append(Paragraph("1. STUDENT DETAILS", section_title))
    student_data = [
        [
            Paragraph("<b>Student ID:</b>", body_style),
            Paragraph(f"#{student.id}", body_style),
            Paragraph("<b>Full Name:</b>", body_style),
            Paragraph(student.name, body_style),
        ],
        [
            Paragraph("<b>Department:</b>", body_style),
            Paragraph(student.department, body_style),
            Paragraph("<b>Year of Study:</b>", body_style),
            Paragraph(f"Year {student.year}", body_style),
        ],
        [
            Paragraph("<b>Email Address:</b>", body_style),
            Paragraph(student.email, body_style),
            Paragraph("<b>Phone:</b>", body_style),
            Paragraph(student.phone, body_style),
        ],
    ]
    student_table = Table(student_data, colWidths=[100, 170, 100, 170])
    student_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    elements.append(student_table)
    elements.append(Spacer(1, 16))

    # ── 2. Attendance Summary Section ──
    elements.append(Paragraph("2. ATTENDANCE RECORD & STATISTICS", section_title))
    att_pct = attendance_summary.get("percentage", 0.0)
    status_str = "Excellent (>= 85%)" if att_pct >= 85 else ("Good (>= 75%)" if att_pct >= 75 else "Needs Improvement (< 75%)")
    att_color = colors.HexColor("#059669") if att_pct >= 75 else colors.HexColor("#dc2626")

    att_summary_data = [
        [
            Paragraph("<b>Total Sessions:</b>", body_style),
            Paragraph(str(attendance_summary.get("total_days", 0)), body_style),
            Paragraph("<b>Days Present:</b>", body_style),
            Paragraph(str(attendance_summary.get("present_days", 0)), body_style),
        ],
        [
            Paragraph("<b>Days Absent:</b>", body_style),
            Paragraph(str(attendance_summary.get("absent_days", 0)), body_style),
            Paragraph("<b>Days Late:</b>", body_style),
            Paragraph(str(attendance_summary.get("late_days", 0)), body_style),
        ],
        [
            Paragraph("<b>Attendance Percentage:</b>", body_style),
            Paragraph(f"<b>{att_pct:.1f}%</b> ({status_str})", body_style),
            Paragraph("<b>Status:</b>", body_style),
            Paragraph(f"<b>{status_str}</b>", body_style),
        ],
    ]
    att_table = Table(att_summary_data, colWidths=[130, 140, 120, 150])
    att_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4") if att_pct >= 75 else colors.HexColor("#fef2f2")),
            ("BOX", (0, 0), (-1, -1), 1, att_color),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    elements.append(att_table)
    elements.append(Spacer(1, 8))

    # Recent attendance log (if any)
    if attendance_records:
        recent_log_data = [["Date", "Status", "Remarks"]]
        for rec in attendance_records[:10]:
            recent_log_data.append([
                str(rec.date),
                rec.status,
                rec.remarks or "—",
            ])
        recent_log_table = Table(recent_log_data, colWidths=[120, 120, 300])
        recent_log_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("PADDING", (0, 0), (-1, -1), 4),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
            ])
        )
        elements.append(recent_log_table)

    elements.append(Spacer(1, 16))

    # ── 3. Academic Results Section ──
    elements.append(Paragraph("3. ACADEMIC RESULTS & MARKS TRANSCRIPT", section_title))
    if marks_records:
        marks_table_data = [
            ["Subject", "Exam Type", "Marks", "Max Marks", "Percentage", "Grade", "Semester"]
        ]
        for m in marks_records:
            pct = (m.marks_obtained / m.max_marks * 100) if m.max_marks > 0 else 0
            marks_table_data.append([
                m.subject,
                m.exam_type,
                f"{m.marks_obtained:.1f}",
                f"{m.max_marks:.1f}",
                f"{pct:.1f}%",
                m.grade,
                m.semester or "Semester 1",
            ])

        # Overall summary row
        ov_obtained = academic_summary.get("total_marks_obtained", 0)
        ov_max = academic_summary.get("total_max_marks", 0)
        ov_pct = academic_summary.get("overall_percentage", 0)
        ov_grade = academic_summary.get("overall_grade", "N/A")

        marks_table_data.append([
            "OVERALL SUMMARY",
            f"{len(marks_records)} Subjects",
            f"{ov_obtained:.1f}",
            f"{ov_max:.1f}",
            f"{ov_pct:.1f}%",
            ov_grade,
            "—",
        ])

        marks_table = Table(marks_table_data, colWidths=[130, 80, 55, 60, 65, 50, 100])
        marks_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#312e81")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("ALIGN", (2, 0), (5, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 1), (-1, -2), colors.HexColor("#f8fafc")),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("PADDING", (0, 0), (-1, -1), 4),
                # Highlight summary row
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e0e7ff")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#1e1b4b")),
            ])
        )
        elements.append(marks_table)
    else:
        elements.append(
            Paragraph("<i>No academic marks records have been entered yet for this student.</i>", body_style)
        )

    elements.append(Spacer(1, 24))
    elements.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#94a3b8"), spaceAfter=8))
    elements.append(
        Paragraph(
            "This report is computer-generated and verified by the Student Management System. Valid without signature.",
            meta_style,
        )
    )

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_report_card_pdf(student, academic_summary, marks_records, attendance_summary) -> io.BytesIO:
    """
    Generates a formal, official downloadable Academic Report Card PDF
    with institutional letterhead, student profile, transcript, attendance
    standing, grading scale legend, and examination board sign-off.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32,
    )

    styles = getSampleStyleSheet()

    header_inst_style = ParagraphStyle(
        "InstHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,
    )
    doc_type_style = ParagraphStyle(
        "DocType",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#4338ca"),
        alignment=1,
    )
    meta_style = ParagraphStyle(
        "MetaSub",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )
    section_h2 = ParagraphStyle(
        "SecH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#1e1b4b"),
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "CardBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1e293b"),
    )
    bold_style = ParagraphStyle(
        "CardBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
    )

    elements = []

    # ── Top Institutional Header ──
    elements.append(Paragraph("NATIONAL INSTITUTE OF ACADEMIC SCIENCES", header_inst_style))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph("OFFICIAL STUDENT ACADEMIC REPORT CARD", doc_type_style))
    elements.append(Spacer(1, 2))
    elements.append(
        Paragraph(
            f"Academic Session 2025–2026 • Issued on {datetime.now().strftime('%B %d, %Y')}",
            meta_style,
        )
    )
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#4338ca"), spaceAfter=10))

    # ── Student Demographics Box ──
    elements.append(Paragraph("STUDENT IDENTIFICATION", section_h2))
    stud_info = [
        [
            Paragraph("<b>Student Name:</b>", body_style),
            Paragraph(student.name, bold_style),
            Paragraph("<b>Roll / Student ID:</b>", body_style),
            Paragraph(f"SMS-{student.id:04d}", bold_style),
        ],
        [
            Paragraph("<b>Department:</b>", body_style),
            Paragraph(student.department, bold_style),
            Paragraph("<b>Year of Study:</b>", body_style),
            Paragraph(f"Year {student.year} (Semester 1)", bold_style),
        ],
        [
            Paragraph("<b>Email:</b>", body_style),
            Paragraph(student.email, body_style),
            Paragraph("<b>Contact Phone:</b>", body_style),
            Paragraph(student.phone, body_style),
        ],
    ]
    t_stud = Table(stud_info, colWidths=[90, 180, 110, 160])
    t_stud.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    elements.append(t_stud)
    elements.append(Spacer(1, 12))

    # ── Academic Transcript Table ──
    elements.append(Paragraph("ACADEMIC PERFORMANCE & TRANSCRIPT", section_h2))
    if marks_records:
        transcript_data = [
            ["Course / Subject", "Evaluation", "Max", "Scored", "Pct", "Grade", "Status"]
        ]
        for m in marks_records:
            pct = (m.marks_obtained / m.max_marks * 100) if m.max_marks > 0 else 0
            status_text = "PASS" if pct >= 40 else "FAIL"
            transcript_data.append([
                m.subject,
                m.exam_type,
                f"{m.max_marks:.0f}",
                f"{m.marks_obtained:.1f}",
                f"{pct:.1f}%",
                m.grade,
                status_text,
            ])

        # Summary Row
        ov_obtained = academic_summary.get("total_marks_obtained", 0)
        ov_max = academic_summary.get("total_max_marks", 0)
        ov_pct = academic_summary.get("overall_percentage", 0)
        ov_grade = academic_summary.get("overall_grade", "N/A")
        overall_status = "PASS" if ov_pct >= 40 else "FAIL"

        transcript_data.append([
            f"TOTAL / CUMULATIVE ({len(marks_records)} Subjects)",
            "Cumulative",
            f"{ov_max:.0f}",
            f"{ov_obtained:.1f}",
            f"{ov_pct:.1f}%",
            ov_grade,
            overall_status,
        ])

        t_trans = Table(transcript_data, colWidths=[170, 95, 50, 55, 55, 55, 60])
        t_trans.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e1b4b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("ALIGN", (2, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 1), (-1, -2), colors.HexColor("#ffffff")),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("PADDING", (0, 0), (-1, -1), 4),
                # Bottom Summary Row
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e0e7ff")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#1e1b4b")),
            ])
        )
        elements.append(t_trans)
    else:
        elements.append(Paragraph("<i>No course grades recorded for the current term.</i>", body_style))

    elements.append(Spacer(1, 10))

    # ── Attendance & Standing Summary ──
    elements.append(Paragraph("ATTENDANCE STANDING & CLEARANCE", section_h2))
    att_pct = attendance_summary.get("percentage", 0.0)
    att_clearance = "CLEAR / ELIGIBLE" if att_pct >= 75 else "SHORTAGE / PROBATION (<75%)"
    att_color = colors.HexColor("#15803d") if att_pct >= 75 else colors.HexColor("#b91c1c")

    att_card = [
        [
            Paragraph("<b>Total Lectures:</b>", body_style),
            Paragraph(str(attendance_summary.get("total_days", 0)), bold_style),
            Paragraph("<b>Attended:</b>", body_style),
            Paragraph(str(attendance_summary.get("present_days", 0)), bold_style),
            Paragraph("<b>Attendance Rate:</b>", body_style),
            Paragraph(f"<b>{att_pct:.1f}%</b>", bold_style),
            Paragraph("<b>Exam Clearance:</b>", body_style),
            Paragraph(f"<b>{att_clearance}</b>", bold_style),
        ]
    ]
    t_att = Table(att_card, colWidths=[80, 50, 60, 50, 95, 60, 85, 60])
    t_att.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4") if att_pct >= 75 else colors.HexColor("#fef2f2")),
            ("BOX", (0, 0), (-1, -1), 1, att_color),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    elements.append(t_att)
    elements.append(Spacer(1, 10))

    # ── Grading Scale Legend ──
    elements.append(Paragraph("GRADING SCALE CRITERIA", section_h2))
    grading_legend = [
        ["Grade", "A+", "A", "B", "C", "D", "F"],
        ["Percentage", ">= 90%", "80% – 89%", "70% – 79%", "60% – 69%", "50% – 59%", "< 50%"],
        ["Remark", "Outstanding", "Excellent", "Very Good", "Good", "Pass", "Fail / Backlog"],
    ]
    t_leg = Table(grading_legend, colWidths=[90, 75, 75, 75, 75, 75, 75])
    t_leg.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    elements.append(t_leg)
    elements.append(Spacer(1, 16))

    # ── Official Signatures & Seal Section ──
    sign_data = [
        [
            Paragraph("Prepared by:<br/><b>Academic Office</b>", meta_style),
            Paragraph("Verified by:<br/><b>Department Head</b>", meta_style),
            Paragraph("Approved & Issued by:<br/><b>Controller of Examinations</b>", meta_style),
        ],
        [
            Paragraph("<br/><br/>______________________", meta_style),
            Paragraph("<br/><br/>______________________", meta_style),
            Paragraph("<br/><br/>______________________<br/>(Official Seal)", meta_style),
        ]
    ]
    t_sign = Table(sign_data, colWidths=[180, 180, 180])
    t_sign.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    elements.append(t_sign)

    doc.build(elements)
    buffer.seek(0)
    return buffer

