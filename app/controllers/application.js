import Controller from "@ember/controller";

export default Controller.extend({
  links: Object.freeze([
    { label: "Exericise 1", model: "exercise-1" },
    { label: "Exericise 2", model: "exercise-2" },
    { label: "Exericise 3", model: "exercise-3" }
  ])
});
