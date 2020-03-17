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
  handleTextareaKeydown(e) {
    if (e.keyCode == 13 && e.metaKey) {
      this.makeRequest();
    }
  }

  @action
  handleSubmit(e) {
    e.preventDefault();
    this.makeRequest();
  }

  makeRequest() {
    this.args.onRequest();
    let body =
      this.method === "GET"
        ? null
        : JSON.stringify(eval("(" + this.requestBody + ")"));

    fetch(this.endpoint, {
      method: this.method,
      body
    })
      .then(() => {
        this.error = null;
      })
      .catch(e => {
        this.args.onError();
        console.error(e);
        this.error = `Your Mirage server has no handler for a ${this.method} request to "${this.endpoint}".`;
      });
  }
}
