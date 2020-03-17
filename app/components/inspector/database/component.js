import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class extends Component {
  @tracked activeTableName = this.tableNames ? this.tableNames[0] : null;

  @action
  setActiveTableName(tableName) {
    this.activeTableName = tableName;
  }

  get tableNames() {
    return Object.keys(this.args.db);
  }

  get records() {
    return this.args.db[this.activeTableName];
  }

  get fields() {
    let fields = this.records[0] ? Object.keys(this.records[0]) : [];

    return fields.sort((a, b) => {
      if (a === "id") {
        return -1;
      }
      if (b === "id") {
        return -1;
      }
    });
  }

  get rows() {
    return this.records.map(record => {
      return { attrs: this.fields.map(field => record[field]) };
    });
  }
}
