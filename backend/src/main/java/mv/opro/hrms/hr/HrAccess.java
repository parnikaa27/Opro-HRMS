package mv.opro.hrms.hr;

import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

// The gate for everything HR does. The frontend hides HR pages from everyone else; this is what actually stops them.
@Component
public class HrAccess {

    public Employee require(Employee employee) {
        if (!employee.isHr()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HR only");
        }
        return employee;
    }
}
