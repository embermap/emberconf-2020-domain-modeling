import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class CounterComponent extends Component {
  @tracked db = this.args.server.db.dump();
  @tracked isRequesting = false;

  @action
  handleRequest() {
    this.isRequesting = true;
  }

  @action
  handleError() {
    this.isRequesting = false;
  }

  @action
  handleResponse() {
    this.isRequesting = false;

    // refresh the db
    this.db = this.args.server.db.dump();
  }
}
