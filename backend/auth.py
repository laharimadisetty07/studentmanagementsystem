import os
import re
from datetime import datetime, timedelta
from typing import Optional, List, Callable
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db
import models

SECRET_KEY = os.getenv("SECRET_KEY", "student-mgmt-super-secret-key-2026-auth")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT token containing user identity and role claims."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    """Dependency that authenticates the Bearer token and returns the current User."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject identity.",
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token. Please log in again.",
        )

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this token no longer exists.",
        )
    # Enforce account status for student accounts
    if user.role == "student":
        acct_status = getattr(user, "account_status", "approved") or "approved"
        if acct_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is pending admin approval. Please wait for an administrator to activate your account.",
            )
        if acct_status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account application has been rejected. Please contact the administrator.",
            )
        if acct_status == "deactivated":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact the administrator.",
            )
    return user


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """Dependency returning the User if authenticated, else None."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            return None
        return db.query(models.User).filter(models.User.username == username).first()
    except Exception:
        return None


def require_roles(*allowed_roles: str) -> Callable:
    """Dependency factory enforcing that the authenticated user holds one of the specified roles."""
    def role_checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role in [{', '.join(allowed_roles)}], "
                    f"but your account role is '{current_user.role}'."
                ),
            )
        return current_user
    return role_checker


# Commonly used role dependencies
require_admin = require_roles("admin")
require_faculty_or_admin = require_roles("admin", "faculty")
require_authenticated = require_roles("admin", "faculty", "student")


def verify_student_access(
    requested_student_id: int,
    current_user: models.User,
    db: Session,
    action: str = "read",
) -> None:
    """
    Core RBAC access enforcement for student-specific resources:
    - Admin: Full read/write access to any student.
    - Faculty: Read access to any student; Write access restricted to students in their department (if configured).
    - Student: Read access ONLY to their own student_id. Zero write access. Accessing another student yields 403 Forbidden.
    """
    if current_user.role == "admin":
        return

    if current_user.role == "student":
        if action != "read":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students are not authorized to modify attendance, marks, or records.",
            )
        if current_user.student_id != requested_student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You are only authorized to view your own student record (#{current_user.student_id}).",
            )
        return

    if current_user.role == "faculty":
        if action == "read":
            return
        # For write actions (recording marks/attendance), enforce departmental authorization if specified
        if current_user.department and current_user.department.lower() != "all":
            student = db.query(models.Student).filter(models.Student.id == requested_student_id).first()
            if student and student.department.strip().lower() != current_user.department.strip().lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        f"Faculty authorization limited to '{current_user.department}'. "
                        f"Student #{requested_student_id} is enrolled in '{student.department}'."
                    ),
                )
        return


def init_rbac_users(db: Session, engine):
    """
    Ensures users table has required columns and seeds default role accounts:
    1. Admin: admin / admin123
    2. Faculty: faculty / faculty123 (Dept: Computer Science)
    3. Faculty IT: faculty_it / faculty123 (Dept: Information Technology)
    4. Student users for all existing students in the database (password: student123)
    """
    # Idempotent column migrations — safe to run multiple times
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'approved';"))
            # Back-fill: existing student accounts that have no status yet get 'approved'
            # (they were created before this feature and can already log in)
            conn.execute(text("UPDATE users SET account_status = 'approved' WHERE account_status IS NULL;"))
            conn.commit()
    except Exception as col_err:
        print(f"[init_rbac_users] Note on column migration: {col_err}")

    # 1. Admin
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        db.add(models.User(
            username="admin",
            hashed_password=hash_password("admin123"),
            role="admin",
        ))
    else:
        admin.role = "admin"

    # 2. Faculty
    faculty_cs = db.query(models.User).filter(models.User.username == "faculty").first()
    if not faculty_cs:
        db.add(models.User(
            username="faculty",
            hashed_password=hash_password("faculty123"),
            role="faculty",
            department="Computer Science",
        ))
    else:
        faculty_cs.role = "faculty"
        if not faculty_cs.department:
            faculty_cs.department = "Computer Science"

    faculty_it = db.query(models.User).filter(models.User.username == "faculty_it").first()
    if not faculty_it:
        db.add(models.User(
            username="faculty_it",
            hashed_password=hash_password("faculty123"),
            role="faculty",
            department="Information Technology",
        ))

    db.commit()

    # 3. Seed student accounts for all existing student records
    students = db.query(models.Student).all()
    for s in students:
        # Check if student already has a user account
        existing_user = db.query(models.User).filter(models.User.student_id == s.id).first()
        if not existing_user:
            # Choose a clean username: lowercase first name or email prefix
            base_name = re.sub(r'[^a-zA-Z0-9]', '', s.name.split()[0].lower())
            if not base_name:
                base_name = f"student_{s.id}"

            candidate_username = base_name
            # If candidate username is taken by someone else, use student_{id}
            taken = db.query(models.User).filter(models.User.username == candidate_username).first()
            if taken:
                candidate_username = f"student_{s.id}"

            db.add(models.User(
                username=candidate_username,
                hashed_password=hash_password("student123"),
                role="student",
                student_id=s.id,
                department=s.department,
                # Seed accounts for EXISTING students are auto-approved
                # (they already existed before approval workflow was added)
                account_status="approved",
            ))

    db.commit()
