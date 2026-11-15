package mv.opro.hrms.flight;

import org.springframework.data.jpa.repository.JpaRepository;

interface FlightAllowanceRepository extends JpaRepository<FlightAllowance, FlightAllowance.Key> {}
