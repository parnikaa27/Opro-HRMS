package mv.opro.hrms.record;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// Someone's own record: what HR keeps about them, and their bank details, which they enter themselves.
@Tag(name = "My record", description = "Your insurance, education and experience (kept by HR), and your bank details, which you enter and HR verifies.")
@RestController
class RecordController {

    record BankBody(@NotBlank @Size(max = 80) String bankName, @NotBlank @Size(max = 120) String accountName,
            @NotBlank @Pattern(regexp = "[0-9 ]{6,40}", message = "has to be 6 to 40 digits") String accountNumber,
            @NotNull @Pattern(regexp = "MVR|USD") String currency) {}

    private final Records records;
    private final CurrentUser currentUser;

    RecordController(Records records, CurrentUser currentUser) {
        this.records = records;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/profile/record")
    RecordResponses.RecordResponse mine() {
        return RecordResponses.RecordResponse.of(records.of(currentUser.get().getId()), false);
    }

    // New details wait for HR to verify them before payroll uses them.
    @PutMapping("/api/profile/bank-account")
    RecordResponses.BankResponse bank(@Valid @RequestBody BankBody body) {
        Employee me = currentUser.get();
        BankAccount saved = records.submitBank(me, new Records.Bank(body.bankName(), body.accountName(), body.accountNumber(), body.currency()));
        return RecordResponses.BankResponse.of(saved, me.getFullName(), false);
    }
}
