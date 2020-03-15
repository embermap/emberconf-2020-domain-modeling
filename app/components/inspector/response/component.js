import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
// import { action } from "@ember/object";

export default class extends Component {
  @tracked response;

  constructor() {
    super(...arguments);

    let originalHandler = this.args.server.pretender.handledRequest.bind(
      this.args.server.pretender
    );

    this.args.server.pretender.handledRequest = (verb, path, request) => {
      originalHandler(verb, path, request);

      this.response = {
        responseText: request.responseText,
        headers: request.responseHeaders
      };
    };
  }

  get json() {
    return JSON.stringify(JSON.parse(this.response.responseText), null, 2);
  }

  get headers() {
    return this.response.headers;
  }

  get hasResponse() {
    return this.response;
  }
}
