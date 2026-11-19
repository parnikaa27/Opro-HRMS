package mv.opro.hrms.performance;

// Field names match the frontend's Goal.
public record GoalResponse(String id, String title, String measure, int weight, Integer rating, String comment) {

    static GoalResponse of(Goal goal) {
        return new GoalResponse(goal.getId(), goal.getTitle(), goal.getMeasure(), goal.getWeight(), goal.getRating(), goal.getComment());
    }
}
