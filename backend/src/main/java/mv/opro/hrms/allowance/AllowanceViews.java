package mv.opro.hrms.allowance;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.employee.People;
import org.springframework.stereotype.Component;

// Turns allowances into responses, with type and people's names filled in. Shared by the controllers.
@Component
class AllowanceViews {

    private final Allowances allowances;
    private final People people;

    AllowanceViews(Allowances allowances, People people) {
        this.allowances = allowances;
        this.people = people;
    }

    AllowanceResponses.AllowancesResponse of(String employeeId) {
        return new AllowanceResponses.AllowancesResponse(
                allowances.monthlyOf(employeeId).stream().map(allowance -> AllowanceResponses.MonthlyResponse.of(allowance, typeNames())).toList(),
                grants(allowances.grantsOf(employeeId)));
    }

    List<AllowanceResponses.GrantResponse> grants(List<AllowanceGrant> grants) {
        Map<String, String> names = people.namesOf(grants.stream()
                .flatMap(grant -> Stream.of(grant.getEmployeeId(), grant.getGrantedBy(), grant.getDecidedBy()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        Function<String, String> typeName = typeNames();
        return grants.stream().map(grant -> AllowanceResponses.GrantResponse.of(grant, typeName, names)).toList();
    }

    AllowanceResponses.MonthlyResponse monthly(MonthlyAllowance allowance) {
        return AllowanceResponses.MonthlyResponse.of(allowance, typeNames());
    }

    private Function<String, String> typeNames() {
        Map<String, String> byCode = allowances.types().stream().collect(Collectors.toMap(AllowanceType::getCode, AllowanceType::getName));
        return code -> byCode.getOrDefault(code, code);
    }
}
