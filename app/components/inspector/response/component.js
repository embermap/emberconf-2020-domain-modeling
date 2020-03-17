import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class extends Component {
  @tracked response;

  constructor() {
    super(...arguments);

    let originalHandler = this.args.server.pretender.handledRequest.bind(
      this.args.server.pretender
    );

    this.args.server.pretender.handledRequest = (verb, path, request) => {
      originalHandler(verb, path, request);
      this.args.onHandle();

      this.response = {
        code: request.status,
        responseText: request.responseText,
        headers: request.responseHeaders
      };
    };
  }

  @action
  handleIsRequestingChange() {
    if (this.args.isRequesting === true) {
      this.response = null;
    }
  }

  get json() {
    let responseText = this.response.responseText;
    return responseText
      ? JSON.stringify(JSON.parse(responseText), null, 2)
      : null;
  }

  get headers() {
    return this.response.headers;
  }

  get hasResponse() {
    return this.response;
  }

  get codeBadgeClasses() {
    let classes = {
      success: "bg-green-100 text-green-800",
      fail: "bg-red-100 text-red-800"
    };

    return this.response.code.toString().startsWith("2")
      ? classes.success
      : classes.fail;
  }
}
