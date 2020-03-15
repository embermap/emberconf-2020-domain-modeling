import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";

export default class extends Component {
  @tracked activeIndex = 0;
  // get server() {
  //   if (this._model !== this.args.model) {
  //     this._model = this.args.model;
  //     this._server = startMirage();
  //   }
  //   return this._server;
  // }
}
