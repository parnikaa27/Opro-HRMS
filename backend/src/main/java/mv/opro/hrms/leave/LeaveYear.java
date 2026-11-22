package mv.opro.hrms.leave;

import java.time.LocalDate;

// A leave year runs from someone's joining anniversary to the day before the next one. Its number is the calendar
// year it starts in. Someone who joined on 29 February starts theirs on 28 February in other years.
public record LeaveYear(LocalDate joinedOn, int number) {

    public static LeaveYear containing(LocalDate joinedOn, LocalDate day) {
        return new LeaveYear(joinedOn, joinedOn.withYear(day.getYear()).isAfter(day) ? day.getYear() - 1 : day.getYear());
    }

    public LocalDate start() {
        return joinedOn.withYear(number);
    }

    public LocalDate end() {
        return joinedOn.withYear(number + 1).minusDays(1);
    }

    public boolean contains(LocalDate day) {
        return !day.isBefore(start()) && !day.isAfter(end());
    }

    LeaveYear previous() {
        return new LeaveYear(joinedOn, number - 1);
    }
}
