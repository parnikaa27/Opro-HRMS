import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  ContactRound,
  Download,
  FileText,
  Fingerprint,
  Gauge,
  Globe2,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MoreHorizontal,
  Palmtree,
  Phone,
  Plane,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCheck,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";

type Role = "employee" | "manager";
type View = "Overview" | "Attendance" | "Leave" | "Calendar" | "Documents" | "People";

const portrait =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=85";

const employeeNav: { label: View; icon: typeof Gauge }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Attendance", icon: Fingerprint },
  { label: "Leave", icon: Palmtree },
  { label: "Calendar", icon: CalendarDays },
  { label: "Documents", icon: FileText },
];

const managerNav: { label: View; icon: typeof Gauge }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "People", icon: UsersRound },
  { label: "Attendance", icon: Fingerprint },
  { label: "Leave", icon: UserCheck },
  { label: "Calendar", icon: CalendarDays },
];

const attendanceRows = [
  {
    day: "Today",
    date: "24 Sep, Wed",
    in: "08:56 AM",
    out: "—",
    hours: "06h 14m",
    status: "In office",
  },
  {
    day: "Yesterday",
    date: "23 Sep, Tue",
    in: "08:48 AM",
    out: "05:42 PM",
    hours: "08h 54m",
    status: "Present",
  },
  {
    day: "Monday",
    date: "22 Sep, Mon",
    in: "09:04 AM",
    out: "05:58 PM",
    hours: "08h 54m",
    status: "Present",
  },
  {
    day: "Sunday",
    date: "21 Sep, Sun",
    in: "08:51 AM",
    out: "05:33 PM",
    hours: "08h 42m",
    status: "Present",
  },
  {
    day: "Thursday",
    date: "18 Sep, Thu",
    in: "09:16 AM",
    out: "05:46 PM",
    hours: "08h 30m",
    status: "Late",
  },
];

const holidays = [
  { date: "03", month: "OCT", name: "National Day", day: "Friday", type: "Public holiday" },
  { date: "11", month: "NOV", name: "Republic Day", day: "Tuesday", type: "Public holiday" },
  { date: "25", month: "DEC", name: "Christmas Day", day: "Friday", type: "Company holiday" },
];

const team = [
  {
    name: "Fathimath Zoya",
    role: "Product Designer",
    initials: "FZ",
    status: "Present",
    time: "08:42 AM",
    color: "violet",
  },
  {
    name: "Ahmed Nazeer",
    role: "Frontend Developer",
    initials: "AN",
    status: "Present",
    time: "08:51 AM",
    color: "blue",
  },
  {
    name: "Mariyam Nasha",
    role: "QA Engineer",
    initials: "MN",
    status: "Remote",
    time: "09:02 AM",
    color: "pink",
  },
  {
    name: "Ibrahim Shifaz",
    role: "Backend Developer",
    initials: "IS",
    status: "On leave",
    time: "All day",
    color: "amber",
  },
];

const initialRequests = [
  {
    id: 1,
    name: "Mariyam Nasha",
    initials: "MN",
    type: "Annual leave",
    dates: "28 Sep – 02 Oct",
    days: "5 days",
    reason: "Family travel",
    status: "Pending",
    color: "pink",
  },
  {
    id: 2,
    name: "Ahmed Nazeer",
    initials: "AN",
    type: "Sick leave",
    dates: "25 Sep",
    days: "1 day",
    reason: "Medical appointment",
    status: "Pending",
    color: "blue",
  },
  {
    id: 3,
    name: "Fathimath Zoya",
    initials: "FZ",
    type: "Annual leave",
    dates: "12 – 14 Oct",
    days: "3 days",
    reason: "Personal time",
    status: "Pending",
    color: "violet",
  },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo-wrap">
      <div className="logo-mark">
        <span>O</span>
        <i />
      </div>
      {!compact && <span className="logo-word">opro</span>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status.toLowerCase().replace(" ", "-");
  return (
    <span className={`status-pill ${tone}`}>
      <i />
      {status}
    </span>
  );
}

function CircularProgress({
  value,
  label,
  sub,
  color = "aqua",
}: {
  value: number;
  label: string;
  sub: string;
  color?: string;
}) {
  return (
    <div
      className="circle-progress"
      style={
        {
          "--progress": `${value * 3.6}deg`,
          "--ring": color === "aqua" ? "#15b8a6" : "#fdba4a",
        } as React.CSSProperties
      }
    >
      <div>
        <strong>{label}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}

function Sidebar({
  role,
  view,
  setView,
  open,
  close,
}: {
  role: Role;
  view: View;
  setView: (v: View) => void;
  open: boolean;
  close: () => void;
}) {
  const nav = role === "manager" ? managerNav : employeeNav;
  return (
    <>
      {open && (
        <button className="sidebar-backdrop" aria-label="Close navigation" onClick={close} />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Logo />
          <button className="mobile-close" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={view === label ? "active" : ""}
              onClick={() => {
                setView(label);
                close();
              }}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Leave" && role === "manager" && <b>3</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button>
            <CircleHelp size={19} />
            <span>Help & support</span>
          </button>
          <div className="location-card">
            <div className="location-icon">
              <MapPin size={18} />
            </div>
            <div>
              <span>Current office</span>
              <strong>Malé, Maldives</strong>
            </div>
          </div>
          <button className="signout">
            <LogOut size={19} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function Header({
  role,
  setRole,
  openNav,
}: {
  role: Role;
  setRole: (r: Role) => void;
  openNav: () => void;
}) {
  const [notifications, setNotifications] = useState(false);
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={openNav}>
        <Menu size={22} />
      </button>
      <div className="header-search">
        <Search size={18} />
        <input aria-label="Search" placeholder="Search anything..." />
        <kbd>⌘ K</kbd>
      </div>
      <div className="top-actions">
        <div className="role-switch" aria-label="Switch role">
          <button
            className={role === "employee" ? "active" : ""}
            onClick={() => setRole("employee")}
          >
            Employee
          </button>
          <button className={role === "manager" ? "active" : ""} onClick={() => setRole("manager")}>
            Manager
          </button>
        </div>
        <div className="notification-wrap">
          <button
            className="icon-button"
            aria-label="Notifications"
            onClick={() => setNotifications(!notifications)}
          >
            <Bell size={19} />
            <i />
          </button>
          {notifications && (
            <div className="notification-popover">
              <div>
                <strong>Notifications</strong>
                <span>3 new</span>
              </div>
              <p>
                <b>Leave request updated</b>Your annual leave was approved.
              </p>
              <p>
                <b>Attendance synced</b>Today’s biometric punch is recorded.
              </p>
              <p>
                <b>Visa reminder</b>Your visa expires in 188 days.
              </p>
            </div>
          )}
        </div>
        <button className="profile-button">
          <img src={portrait} alt="Ameen Riza" />
          <span>
            <strong>Ameen Riza</strong>
            <small>{role === "manager" ? "Product Manager" : "Employee · OPR-042"}</small>
          </span>
          <ChevronDown size={15} />
        </button>
      </div>
    </header>
  );
}

function WelcomeBanner({ role }: { role: Role }) {
  return (
    <section className="welcome">
      <div>
        <p>
          <Sparkles size={14} /> WEDNESDAY, 24 SEPTEMBER
        </p>
        <h1>Good morning, Ameen.</h1>
        <span>
          {role === "manager"
            ? "Your team is looking good today. 12 of 14 people are checked in."
            : "You’re right on time. Here’s everything you need for the day."}
        </span>
      </div>
      <div className="welcome-art">
        <div className="sun" />
        <div className="island">
          <Palmtree size={52} strokeWidth={1.4} />
        </div>
        <div className="wave w1" />
        <div className="wave w2" />
      </div>
    </section>
  );
}

function EmployeeOverview({
  openLeave,
  setView,
}: {
  openLeave: () => void;
  setView: (v: View) => void;
}) {
  return (
    <>
      <WelcomeBanner role="employee" />
      <div className="employee-grid">
        <div className="main-column">
          <section className="attendance-hero card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">TODAY’S ATTENDANCE</span>
                <h2>You’re in the office</h2>
              </div>
              <div className="synced">
                <i />
                Biometric synced · 3 min ago
              </div>
            </div>
            <div className="attendance-body">
              <CircularProgress value={78} label="6h 14m" sub="of 8 hours" />
              <div className="punch-timeline">
                <div className="timeline-line">
                  <i />
                  <i />
                </div>
                <div>
                  <span>PUNCH IN</span>
                  <strong>08:56 AM</strong>
                  <small>Front desk device</small>
                </div>
                <div>
                  <span>EXPECTED OUT</span>
                  <strong>05:56 PM</strong>
                  <small>1h 46m remaining</small>
                </div>
              </div>
              <div className="work-metric">
                <Timer size={20} />
                <div>
                  <span>Effective hours</span>
                  <strong>5h 48m</strong>
                </div>
              </div>
            </div>
            <button className="text-link" onClick={() => setView("Attendance")}>
              View attendance details <ArrowRight size={15} />
            </button>
          </section>

          <div className="balance-grid">
            <section className="card balance-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">LEAVE BALANCE</span>
                  <h2>Your time off</h2>
                </div>
                <button className="more">
                  <MoreHorizontal />
                </button>
              </div>
              <div className="leave-stats">
                <div className="big-stat">
                  <strong>18</strong>
                  <span>days available</span>
                </div>
                <div className="mini-stats">
                  <div>
                    <i className="annual" />
                    <span>
                      Annual leave<b>12 days</b>
                    </span>
                  </div>
                  <div>
                    <i className="sick" />
                    <span>
                      Sick leave<b>6 days</b>
                    </span>
                  </div>
                </div>
              </div>
              <button className="primary-button" onClick={openLeave}>
                <Plus size={17} /> Request leave
              </button>
            </section>
            <section className="card visa-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">WORK VISA</span>
                  <h2>Visa status</h2>
                </div>
                <StatusPill status="Valid" />
              </div>
              <div className="visa-main">
                <div className="visa-icon">
                  <Globe2 size={26} />
                </div>
                <div>
                  <span>Employment Visa</span>
                  <strong>A0892147</strong>
                </div>
              </div>
              <div className="visa-dates">
                <div>
                  <span>Expiry date</span>
                  <strong>31 Mar 2026</strong>
                </div>
                <div>
                  <span>Time remaining</span>
                  <strong>188 days</strong>
                </div>
              </div>
              <div className="progress-track">
                <i />
              </div>
              <small className="visa-note">
                <ShieldCheck size={14} /> No action needed right now
              </small>
            </section>
          </div>

          <section className="card recent-section">
            <div className="card-heading">
              <div>
                <span className="eyebrow">THIS WEEK</span>
                <h2>Recent attendance</h2>
              </div>
              <button className="text-link" onClick={() => setView("Attendance")}>
                View report <ArrowRight size={15} />
              </button>
            </div>
            <AttendanceTable rows={attendanceRows.slice(0, 4)} />
          </section>
        </div>

        <div className="side-column">
          <IdCard />
          <section className="card holiday-card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">UP NEXT</span>
                <h2>Holiday calendar</h2>
              </div>
              <button className="small-calendar" onClick={() => setView("Calendar")}>
                <CalendarDays size={18} />
              </button>
            </div>
            <div className="next-holiday">
              <div className="date-box">
                <b>03</b>
                <span>OCT</span>
              </div>
              <div>
                <strong>National Day</strong>
                <span>Friday · Public holiday</span>
              </div>
            </div>
            <div className="holiday-countdown">
              <Plane size={17} />
              <span>
                Your next long weekend is in <b>9 days</b>
              </span>
            </div>
            <button className="text-link" onClick={() => setView("Calendar")}>
              See all holidays <ArrowRight size={15} />
            </button>
          </section>
          <section className="card approval-card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">LATEST REQUEST</span>
                <h2>Leave approval</h2>
              </div>
            </div>
            <div className="approval-row">
              <div className="approval-icon">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <strong>Annual leave approved</strong>
                <span>06–08 October · 3 days</span>
              </div>
            </div>
            <div className="approved-by">
              <span>Approved by Shifaau</span>
              <StatusPill status="Approved" />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function IdCard() {
  return (
    <section className="id-card">
      <div className="id-top">
        <Logo compact />
        <span>EMPLOYEE</span>
      </div>
      <div className="id-profile">
        <div className="portrait-wrap">
          <img src={portrait} alt="Ameen Riza" />
          <i />
        </div>
        <div>
          <h2>Ameen Riza</h2>
          <p>Product Designer</p>
          <span>OPR–042</span>
        </div>
      </div>
      <div className="id-details">
        <div>
          <Mail size={15} />
          <span>ameen.riza@opro.mv</span>
        </div>
        <div>
          <Phone size={15} />
          <span>+960 771 2042</span>
        </div>
        <div>
          <BriefcaseBusiness size={15} />
          <span>Product · Full-time</span>
        </div>
      </div>
      <div className="id-footer">
        <span>
          <BadgeCheck size={15} /> Active employee
        </span>
        <b>OPRO · MALDIVES</b>
      </div>
    </section>
  );
}

function AttendanceTable({ rows = attendanceRows }: { rows?: typeof attendanceRows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>DAY</th>
            <th>PUNCH IN</th>
            <th>PUNCH OUT</th>
            <th>WORK HOURS</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>
                <strong>{row.day}</strong>
                <span>{row.date}</span>
              </td>
              <td>{row.in}</td>
              <td>{row.out}</td>
              <td>
                <b>{row.hours}</b>
              </td>
              <td>
                <StatusPill status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManagerOverview({
  requests,
  updateRequest,
  setView,
}: {
  requests: typeof initialRequests;
  updateRequest: (id: number, status: string) => void;
  setView: (v: View) => void;
}) {
  const pending = requests.filter((r) => r.status === "Pending").length;
  return (
    <>
      <WelcomeBanner role="manager" />
      <div className="manager-stats">
        <div className="stat-card">
          <div className="stat-icon aqua">
            <UsersRound />
          </div>
          <div>
            <span>TEAM MEMBERS</span>
            <strong>14</strong>
            <small>
              <i /> 12 checked in
            </small>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <Clock3 />
          </div>
          <div>
            <span>PENDING REQUESTS</span>
            <strong>{pending}</strong>
            <small>Needs your review</small>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet">
            <Fingerprint />
          </div>
          <div>
            <span>AVG. ATTENDANCE</span>
            <strong>94%</strong>
            <small>
              <i /> +2.4% this month
            </small>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon coral">
            <Plane />
          </div>
          <div>
            <span>OUT OF OFFICE</span>
            <strong>2</strong>
            <small>Today</small>
          </div>
        </div>
      </div>
      <div className="manager-grid">
        <section className="card requests-section">
          <div className="card-heading">
            <div>
              <span className="eyebrow">ACTION NEEDED</span>
              <h2>Leave requests</h2>
            </div>
            <button className="text-link" onClick={() => setView("Leave")}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="request-list">
            {requests.slice(0, 3).map((r) => (
              <div className="request-item" key={r.id}>
                <div className={`avatar ${r.color}`}>{r.initials}</div>
                <div className="request-person">
                  <strong>{r.name}</strong>
                  <span>
                    {r.type} · {r.reason}
                  </span>
                </div>
                <div className="request-dates">
                  <strong>{r.dates}</strong>
                  <span>{r.days}</span>
                </div>
                {r.status === "Pending" ? (
                  <div className="request-actions">
                    <button
                      className="decline"
                      title="Decline"
                      onClick={() => updateRequest(r.id, "Declined")}
                    >
                      <X size={17} />
                    </button>
                    <button
                      className="approve"
                      title="Approve"
                      onClick={() => updateRequest(r.id, "Approved")}
                    >
                      <Check size={17} />
                    </button>
                  </div>
                ) : (
                  <StatusPill status={r.status} />
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="card team-section">
          <div className="card-heading">
            <div>
              <span className="eyebrow">LIVE STATUS</span>
              <h2>Team today</h2>
            </div>
            <span className="live-dot">
              <i /> Live
            </span>
          </div>
          <div className="team-list">
            {team.map((p) => (
              <div key={p.name}>
                <div className={`avatar ${p.color}`}>{p.initials}</div>
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.role}</span>
                </div>
                <div className="team-status">
                  <StatusPill status={p.status} />
                  <small>{p.time}</small>
                </div>
              </div>
            ))}
          </div>
          <button className="secondary-button" onClick={() => setView("People")}>
            View all team members
          </button>
        </section>
      </div>
      <div className="manager-grid bottom">
        <section className="card team-attendance">
          <div className="card-heading">
            <div>
              <span className="eyebrow">THIS MONTH</span>
              <h2>Attendance overview</h2>
            </div>
            <button className="download-button">
              <Download size={16} /> Export report
            </button>
          </div>
          <div className="chart-area">
            {[76, 88, 92, 84, 96, 62, 78, 91, 87, 94, 97, 82, 93, 89, 96, 74, 90, 95, 86, 92].map(
              (h, i) => (
                <i key={i} style={{ height: `${h}%` }} className={i === 19 ? "today" : ""} />
              ),
            )}
          </div>
          <div className="chart-labels">
            <span>01 Sep</span>
            <span>08 Sep</span>
            <span>15 Sep</span>
            <span>Today</span>
          </div>
        </section>
        <section className="card visa-alerts">
          <div className="card-heading">
            <div>
              <span className="eyebrow">COMPLIANCE</span>
              <h2>Visa alerts</h2>
            </div>
            <span className="alert-count">2</span>
          </div>
          <div className="visa-alert">
            <div className="avatar amber">IS</div>
            <div>
              <strong>Ibrahim Shifaz</strong>
              <span>Expires 12 Oct 2025</span>
            </div>
            <b>18 days</b>
          </div>
          <div className="visa-alert">
            <div className="avatar blue">AR</div>
            <div>
              <strong>Aishath Reem</strong>
              <span>Expires 04 Nov 2025</span>
            </div>
            <b>41 days</b>
          </div>
          <button className="text-link">
            View visa records <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </>
  );
}

function AttendanceView({ role }: { role: Role }) {
  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">BIOMETRIC RECORDS</span>
          <h1>{role === "manager" ? "Team attendance" : "My attendance"}</h1>
          <p>
            {role === "manager"
              ? "Monitor attendance, work hours and anomalies across your team."
              : "Review your punches, work hours and monthly attendance record."}
          </p>
        </div>
        <button className="download-button">
          <Download size={17} /> Export report
        </button>
      </div>
      <div className="summary-row">
        <div className="card metric">
          <span>Days present</span>
          <strong>
            19 <small>/ 20</small>
          </strong>
          <p>
            <i /> 95% attendance
          </p>
        </div>
        <div className="card metric">
          <span>Total work hours</span>
          <strong>164h 20m</strong>
          <p>8h 39m daily average</p>
        </div>
        <div className="card metric">
          <span>On-time arrival</span>
          <strong>92%</strong>
          <p>2 late arrivals</p>
        </div>
        <div className="card metric">
          <span>Overtime</span>
          <strong>6h 12m</strong>
          <p>Across 4 workdays</p>
        </div>
      </div>
      <section className="card full-table">
        <div className="card-heading">
          <div>
            <span className="eyebrow">SEPTEMBER 2025</span>
            <h2>Attendance log</h2>
          </div>
          <div className="filter-chip">
            <CalendarDays size={16} /> 01–24 Sep <ChevronDown size={14} />
          </div>
        </div>
        <AttendanceTable />
      </section>
      <div className="device-note">
        <Fingerprint size={22} />
        <div>
          <strong>Biometric device connected</strong>
          <span>Front Desk · Device OPR-MLE-01 · Last sync 3 minutes ago</span>
        </div>
        <StatusPill status="Online" />
      </div>
    </div>
  );
}

function LeaveView({
  role,
  requests,
  updateRequest,
  openLeave,
}: {
  role: Role;
  requests: typeof initialRequests;
  updateRequest: (id: number, status: string) => void;
  openLeave: () => void;
}) {
  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">{role === "manager" ? "TEAM MANAGEMENT" : "TIME OFF"}</span>
          <h1>{role === "manager" ? "Leave requests" : "Leave & time off"}</h1>
          <p>
            {role === "manager"
              ? "Review and manage leave requests from your team."
              : "Plan your time off and keep track of request statuses."}
          </p>
        </div>
        {role === "employee" && (
          <button className="primary-button compact" onClick={openLeave}>
            <Plus size={17} /> Request leave
          </button>
        )}
      </div>
      {role === "employee" ? (
        <>
          <div className="leave-balance-row">
            <div className="card leave-balance">
              <CircularProgress value={60} label="12" sub="annual days" />
              <div>
                <h3>Annual leave</h3>
                <span>12 of 20 days available</span>
                <div className="progress-track">
                  <i style={{ width: "60%" }} />
                </div>
              </div>
            </div>
            <div className="card leave-balance">
              <CircularProgress value={75} label="6" sub="sick days" color="amber" />
              <div>
                <h3>Sick leave</h3>
                <span>6 of 8 days available</span>
                <div className="progress-track amber">
                  <i style={{ width: "75%" }} />
                </div>
              </div>
            </div>
            <div className="card leave-balance">
              <div className="special-icon">
                <Sparkles />
              </div>
              <div>
                <h3>Special leave</h3>
                <span>3 days available</span>
                <p>Bereavement, parental or study</p>
              </div>
            </div>
          </div>
          <section className="card request-history">
            <div className="card-heading">
              <div>
                <span className="eyebrow">REQUEST HISTORY</span>
                <h2>My leave requests</h2>
              </div>
            </div>
            {[
              ["Annual leave", "06–08 October 2025", "3 days", "Approved"],
              ["Sick leave", "14 August 2025", "1 day", "Approved"],
              ["Annual leave", "01–04 June 2025", "4 days", "Approved"],
              ["Personal leave", "12 May 2025", "1 day", "Declined"],
            ].map((r) => (
              <div className="history-row" key={r[1]}>
                <div className="leave-type-icon">
                  <Palmtree size={18} />
                </div>
                <div>
                  <strong>{r[0]}</strong>
                  <span>{r[1]}</span>
                </div>
                <span>{r[2]}</span>
                <StatusPill status={r[3]} />
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="card all-requests">
          <div className="request-tabs">
            <button className="active">
              Pending <b>{requests.filter((r) => r.status === "Pending").length}</b>
            </button>
            <button>Approved</button>
            <button>Declined</button>
          </div>
          {requests.map((r) => (
            <div className="large-request" key={r.id}>
              <div className={`avatar ${r.color}`}>{r.initials}</div>
              <div>
                <strong>{r.name}</strong>
                <span>{r.type} · Submitted 2 days ago</span>
              </div>
              <div>
                <small>DATES</small>
                <strong>{r.dates}</strong>
              </div>
              <div>
                <small>DURATION</small>
                <strong>{r.days}</strong>
              </div>
              <div>
                <small>REASON</small>
                <strong>{r.reason}</strong>
              </div>
              {r.status === "Pending" ? (
                <div className="request-actions labeled">
                  <button className="decline" onClick={() => updateRequest(r.id, "Declined")}>
                    <X size={16} /> Decline
                  </button>
                  <button className="approve" onClick={() => updateRequest(r.id, "Approved")}>
                    <Check size={16} /> Approve
                  </button>
                </div>
              ) : (
                <StatusPill status={r.status} />
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function CalendarView() {
  const days = Array.from({ length: 35 }, (_, i) => i - 2);
  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">COMPANY CALENDAR</span>
          <h1>Holidays & events</h1>
          <p>Public holidays and important company dates in the Maldives.</p>
        </div>
        <div className="calendar-nav">
          <button>
            <ChevronLeft />
          </button>
          <strong>September 2025</strong>
          <button>
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="calendar-layout">
        <section className="card month-calendar">
          <div className="weekdays">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((n, i) => (
              <div
                key={i}
                className={`${n < 1 || n > 30 ? "muted" : ""} ${n === 24 ? "today" : ""} ${n === 1 || n === 14 ? "event" : ""}`}
              >
                <span>{n < 1 ? 30 + n : n > 30 ? n - 30 : n}</span>
                {n === 1 && <small>Office social</small>}
                {n === 14 && <small>Team review</small>}
                {n === 24 && <i />}
              </div>
            ))}
          </div>
        </section>
        <aside className="calendar-side">
          <section className="card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">UPCOMING</span>
                <h2>Public holidays</h2>
              </div>
            </div>
            {holidays.map((h) => (
              <div className="holiday-list-item" key={h.name}>
                <div className="date-box">
                  <b>{h.date}</b>
                  <span>{h.month}</span>
                </div>
                <div>
                  <strong>{h.name}</strong>
                  <span>
                    {h.day} · {h.type}
                  </span>
                </div>
              </div>
            ))}
          </section>
          <section className="card holiday-policy">
            <div className="policy-icon">
              <Palmtree />
            </div>
            <h3>Holiday policy</h3>
            <p>If a public holiday falls on your rest day, a replacement day will be scheduled.</p>
            <button className="text-link">
              Read policy <ArrowRight size={15} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function PeopleView() {
  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">DIRECTORY</span>
          <h1>People</h1>
          <p>Your team members and their current work status.</p>
        </div>
        <div className="header-search people-search">
          <Search size={17} />
          <input placeholder="Search employee" />
        </div>
      </div>
      <div className="people-grid">
        {[
          ...team,
          {
            name: "Aishath Reem",
            role: "Marketing Specialist",
            initials: "AR",
            status: "Present",
            time: "08:47 AM",
            color: "aqua",
          },
          {
            name: "Hassan Ifaz",
            role: "Finance Executive",
            initials: "HI",
            status: "Remote",
            time: "09:10 AM",
            color: "green",
          },
        ].map((p) => (
          <div className="card person-card" key={p.name}>
            <div className={`avatar large ${p.color}`}>{p.initials}</div>
            <StatusPill status={p.status} />
            <h3>{p.name}</h3>
            <p>{p.role}</p>
            <div>
              <span>
                <Mail size={14} />
                {p.name.split(" ")[0].toLowerCase()}@opro.mv
              </span>
              <span>
                <MapPin size={14} />
                Malé office
              </span>
            </div>
            <button className="secondary-button">View profile</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsView() {
  const docs = [
    ["Employment contract", "PDF · Updated 12 Jan 2025"],
    ["Visa copy", "PDF · Expires 31 Mar 2026"],
    ["National ID", "PDF · Verified"],
    ["Health insurance", "PDF · Updated 05 Feb 2025"],
  ];
  return (
    <div className="page-view">
      <div className="page-title">
        <div>
          <span className="eyebrow">EMPLOYEE FILES</span>
          <h1>Documents</h1>
          <p>Your verified employment and compliance documents.</p>
        </div>
      </div>
      <section className="card document-list">
        {docs.map((d) => (
          <div key={d[0]}>
            <div className="doc-icon">
              <FileText />
            </div>
            <div>
              <strong>{d[0]}</strong>
              <span>{d[1]}</span>
            </div>
            <StatusPill status="Verified" />
            <button className="icon-button">
              <Download size={17} />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function LeaveModal({ close }: { close: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={close}>
          <X size={20} />
        </button>
        {submitted ? (
          <div className="success-state">
            <div>
              <Check size={28} />
            </div>
            <h2>Request submitted</h2>
            <p>Your manager has been notified. You can track the status from the Leave page.</p>
            <button className="primary-button" onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <>
            <span className="eyebrow">TIME OFF</span>
            <h2>Request leave</h2>
            <p className="modal-intro">Submit your leave dates for manager approval.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <label>
                Leave type
                <select defaultValue="Annual leave">
                  <option>Annual leave</option>
                  <option>Sick leave</option>
                  <option>Personal leave</option>
                </select>
              </label>
              <div className="form-row">
                <label>
                  From
                  <input type="date" defaultValue="2025-10-12" />
                </label>
                <label>
                  To
                  <input type="date" defaultValue="2025-10-14" />
                </label>
              </div>
              <label>
                Reason
                <textarea placeholder="Add a short note for your manager..." />
              </label>
              <div className="form-summary">
                <CalendarDays size={19} />
                <div>
                  <strong>3 days requested</strong>
                  <span>12 days will remain after approval</span>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={close}>
                  Cancel
                </button>
                <button className="primary-button">
                  Submit request <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div>
        <Logo />
        <span>People first, always.</span>
      </div>
      <p>© 2025 Opro Pvt Ltd · Malé, Republic of Maldives</p>
      <div>
        <a href="#">Privacy</a>
        <a href="#">HR policies</a>
        <a href="#">Support</a>
      </div>
    </footer>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("employee");
  const [view, setView] = useState<View>("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [requests, setRequests] = useState(initialRequests);
  const changeRole = (next: Role) => {
    setRole(next);
    setView("Overview");
  };
  const updateRequest = (id: number, status: string) =>
    setRequests((items) => items.map((i) => (i.id === id ? { ...i, status } : i)));

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        view={view}
        setView={setView}
        open={mobileNav}
        close={() => setMobileNav(false)}
      />
      <div className="app-content">
        <Header role={role} setRole={changeRole} openNav={() => setMobileNav(true)} />
        <main>
          {view === "Overview" &&
            (role === "employee" ? (
              <EmployeeOverview openLeave={() => setLeaveModal(true)} setView={setView} />
            ) : (
              <ManagerOverview
                requests={requests}
                updateRequest={updateRequest}
                setView={setView}
              />
            ))}
          {view === "Attendance" && <AttendanceView role={role} />}
          {view === "Leave" && (
            <LeaveView
              role={role}
              requests={requests}
              updateRequest={updateRequest}
              openLeave={() => setLeaveModal(true)}
            />
          )}
          {view === "Calendar" && <CalendarView />}
          {view === "People" && <PeopleView />}
          {view === "Documents" && <DocumentsView />}
        </main>
        <Footer />
      </div>
      {leaveModal && <LeaveModal close={() => setLeaveModal(false)} />}
    </div>
  );
}
