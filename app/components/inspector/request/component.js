import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class extends Component {
  @tracked endpoint = "/api/users";

  @action
  makeRequest(e) {
    e.preventDefault();

    fetch(this.endpoint);
  }
}
