package mv.opro.hrms.insight;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// The executive dashboard and the reports, counted on the server so the browser gets only what each page shows.
@Tag(name = "Insights", description = "The executive dashboard's figures and each report's rows. HR and super admins only.")
@RestController
class InsightController {

    private final CurrentUser currentUser;
    private final Dashboards dashboards;
    private final Reports reports;

    InsightController(CurrentUser currentUser, Dashboards dashboards, Reports reports) {
        this.currentUser = currentUser;
        this.dashboards = dashboards;
        this.reports = reports;
    }

    @GetMapping("/api/insights/dashboard")
    Dashboards.Dashboard dashboard() {
        allowed();
        return dashboards.build();
    }

    // kind is headcount, movement, mix, balances, leave, attendance or papers. Movement and leave take a year, attendance a month, mix a by.
    @GetMapping("/api/insights/reports/{kind}")
    Reports.ReportTable report(@PathVariable String kind, @RequestParam(required = false) Integer year, @RequestParam(required = false) String month,
            @RequestParam(required = false) String by) {
        allowed();
        return reports.build(kind, year, monthOf(month), by);
    }

    private static YearMonth monthOf(String month) {
        if (month == null) {
            return null;
        }
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a month like 2026-11.");
        }
    }

    private void allowed() {
        Employee me = currentUser.get();
        if (!me.isHr() && !me.isSuperAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HR and super admins only");
        }
    }
}
