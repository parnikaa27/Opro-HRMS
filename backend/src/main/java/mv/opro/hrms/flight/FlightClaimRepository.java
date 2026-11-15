package mv.opro.hrms.flight;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface FlightClaimRepository extends JpaRepository<FlightClaim, String> {

    List<FlightClaim> findByEmployeeIdOrderByFlightDateDescIdDesc(String employeeId);

    List<FlightClaim> findAllByOrderByRaisedOnDescIdDesc();

    List<FlightClaim> findByStatusOrderByRaisedOnDescIdDesc(String status);

    @Query("""
            select coalesce(sum(c.amountUsd), 0) from FlightClaim c
            where c.employeeId = :employeeId and c.status = :status and c.flightDate between :yearStart and :yearEnd""")
    BigDecimal usdIn(String employeeId, String status, LocalDate yearStart, LocalDate yearEnd);
}
