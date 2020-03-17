import Controller from "@ember/controller";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";

export default class ApplicationController extends Controller {
  @tracked sidebarIsOpen;

  links = [
    { label: "Exercise 1", model: "exercise-1" },
    { label: "Exercise 2", model: "exercise-2" },
    { label: "Exercise 3", model: "exercise-3" }
  ];

  @action
  toggleSidebarIsOpen() {
    this.sidebarIsOpen = !this.sidebarIsOpen;
  }
}
