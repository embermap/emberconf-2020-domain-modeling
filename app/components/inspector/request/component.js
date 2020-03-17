import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class extends Component {
  @tracked method = "GET";
  @tracked endpoint;
  @tracked error;

  @action
  updateMethod(e) {
    this.method = e.target.value;
  }

  @action
  handleInput(e) {
    this.endpoint = e.target.value;
    this.error = null;
  }

  @action
  makeRequest(e) {
    e.preventDefault();

    fetch(this.endpoint, {
      method: this.method,
      body: this.requestBody
    })
      .then(() => {
        this.error = null;
      })

      .catch(e => {
        this.error = `Your Mirage server has no handler for a ${this.method} request to "${this.endpoint}".`;
      });
  }
}
