import Controller from "@ember/controller";

export default class ApplicationController extends Controller {
  links = [
    { label: "Exercise 1", model: "exercise-1" },
    { label: "Exercise 2", model: "exercise-2" },
    { label: "Exercise 3", model: "exercise-3" }
  ];
}
