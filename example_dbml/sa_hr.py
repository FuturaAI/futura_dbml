"""
SQLAlchemy — HR / Gestione Risorse Umane
Incolla questo file nel tab "SQLAlchemy" dell'import da ORM.
"""
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Department(Base):
    __tablename__ = "departments"

    id         = Column(Integer, primary_key=True)
    parent_id  = Column(Integer, ForeignKey("departments.id"))
    name       = Column(String, nullable=False)
    cost_center = Column(String)
    location   = Column(String)


class JobTitle(Base):
    __tablename__ = "job_titles"

    id         = Column(Integer, primary_key=True)
    title      = Column(String, nullable=False, unique=True)
    grade      = Column(String)
    min_salary = Column(Numeric)
    max_salary = Column(Numeric)


class Employee(Base):
    __tablename__ = "employees"

    id            = Column(Integer, primary_key=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    job_title_id  = Column(Integer, ForeignKey("job_titles.id"), nullable=False)
    manager_id    = Column(Integer, ForeignKey("employees.id"))
    first_name    = Column(String, nullable=False)
    last_name     = Column(String, nullable=False)
    email         = Column(String, nullable=False, unique=True)
    phone         = Column(String)
    hire_date     = Column(Date, nullable=False)
    end_date      = Column(Date)
    salary        = Column(Numeric)
    is_active     = Column(Boolean, default=True)


class LeaveType(Base):
    __tablename__ = "leave_types"

    id            = Column(Integer, primary_key=True)
    name          = Column(String, nullable=False, unique=True)
    days_per_year = Column(Integer, nullable=False)
    is_paid       = Column(Boolean, default=True)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id            = Column(Integer, primary_key=True)
    employee_id   = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    approved_by   = Column(Integer, ForeignKey("employees.id"))
    start_date    = Column(Date, nullable=False)
    end_date      = Column(Date, nullable=False)
    status        = Column(String, nullable=False, default="pending")
    notes         = Column(Text)
    requested_at  = Column(DateTime)


class Project(Base):
    __tablename__ = "projects"

    id          = Column(Integer, primary_key=True)
    owner_id    = Column(Integer, ForeignKey("employees.id"), nullable=False)
    name        = Column(String, nullable=False)
    description = Column(Text)
    start_date  = Column(Date)
    end_date    = Column(Date)
    budget      = Column(Numeric)
    status      = Column(String, default="planned")


class ProjectAssignment(Base):
    __tablename__ = "project_assignments"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("projects.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    role        = Column(String)
    allocated_pct = Column(Numeric)
    joined_at   = Column(Date)
