import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class extends Component {
  @tracked method = "GET";
  @tracked endpoint = "/api/messages";

  @action
  updateMethod(e) {
    this.method = e.target.value;
  }

  @action
  makeRequest(e) {
    e.preventDefault();

    fetch(this.endpoint, {
      method: this.method,
      body: this.requestBody
    });
  }
}
