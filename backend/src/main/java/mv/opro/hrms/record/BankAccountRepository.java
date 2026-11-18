package mv.opro.hrms.record;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface BankAccountRepository extends JpaRepository<BankAccount, String> {

    List<BankAccount> findByStatusOrderBySubmittedOn(String status);
}
