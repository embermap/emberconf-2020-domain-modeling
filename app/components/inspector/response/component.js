import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
// import { action } from "@ember/object";

export default class extends Component {
  @tracked json;

  constructor() {
    super(...arguments);

    let originalHandler = this.args.server.pretender.handledRequest.bind(
      this.args.server.pretender
    );

    this.args.server.pretender.handledRequest = (verb, path, request) => {
      originalHandler(verb, path, request);

      this.json = JSON.stringify(JSON.parse(request.responseText), null, 2);
    };
  }
}
