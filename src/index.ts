import schemaParser from "./schema-parser";
import Table from "./table/table";
import template from "./template";
import { Schema, TableArrang, Viewport } from "./types/schema";
import TableData from "./types/table-data";
import validateJson from "./validate-schema";
import Viewer from "./viewer";
import { cloneDeep } from "lodash";

import {
  LoadEvent,
  ReadyEvent,
  ViewportClickEvent,
  TableClickEvent,
  TableDblClickEvent,
  TableContextMenuEvent,
  TableMoveEvent,
  TableMoveEndEvent,
  ZoomInEvent,
  ZoomOutEvent,
  DbViewerEventMap,
  RelationClickEvent,
  RelationDblClickEvent,
} from "./events";
import Point from "./types/point";
import { RelationData } from "./realtion/relation";
import { RelationContextMenuEvent } from "./events";
import Annotation from "./annotation";

const NO_TABLE = new Error("No table exist with the given name.");
const INVALID_SCHEMA = new Error("Invalid schema.");

class DbViewer extends HTMLElement {
  get scrollLeft(): number {
    return this.viewer.getPan().x;
  }

  set scrollLeft(value: number) {
    this.readyPromise.then(() => void this.viewer.setPanX(value));
  }

  get scrollTop(): number {
    return this.viewer.getPan().y;
  }

  set scrollTop(value: number) {
    this.readyPromise.then(() => void this.viewer.setPanY(value));
  }

  set src(src: string) {
    this.setAttribute("src", src);
  }

  static get observedAttributes(): string[] {
    return ["src", "disable-table-movement", "viewport"];
  }

  set schema(schema: Schema | undefined) {
    void this.readyPromise.then(() => {
      if (schema == null || !validateJson(schema)) {
        throw INVALID_SCHEMA;
      }
      this.notParsedSchema = cloneDeep(schema);
      const schemaObj = cloneDeep(schema);
      this.tables = schemaParser(schemaObj);
      this.createAnnotations();

      this.viewer.load(
        this.tables,
        this.#annotations,
        this.viewport ?? schemaObj.viewport,
        schemaObj.arrangement ?? TableArrang.default,
        schemaObj.viewWidth,
        schemaObj.viewHeight
      );
    });
  }

  get schema(): Schema | undefined {
    if (this.notParsedSchema != null) {
      this.notParsedSchema.tables.forEach((notParsedTable) => {
        const tablePos = this.tables.find(
          (table) => table.name === notParsedTable.name
        )!.pos;
        notParsedTable.pos = { ...(tablePos as Point) };
      });
    }
    return cloneDeep(this.notParsedSchema);
  }

  set disableTableMovement(value: boolean) {
    if (value) {
      this.setAttribute("disable-table-movement", "");
    } else {
      this.removeAttribute("disable-table-movement");
    }
  }

  get disableTableMovement(): boolean {
    return this.viewer.getTableMovementDisabled();
  }

  set viewport(value: Viewport | undefined) {
    if (value) {
      this.setAttribute("viewport", value);
    } else {
      this.removeAttribute("viewport");
    }
  }

  get viewport(): Viewport | undefined {
    return this.viewportVal;
  }

  private readyPromise: Promise<null>;
  private readyPromiseResolve!: (value: PromiseLike<null> | null) => void;
  private viewer!: Viewer;
  private tables!: Table[];
  private srcVal!: string;
  private viewportVal!: Viewport;
  private notParsedSchema!: Schema;
  #annotations!: Annotation[];

  constructor() {
    super();
    this.readyPromise = new Promise((resolve) => {
      this.readyPromiseResolve = resolve;
    });
    if (this.checkWindowLoaded()) {
      this.whenWindowLoaded();
    } else {
      window.addEventListener("load", this.whenWindowLoaded);
    }
  }

  getZoom(): number {
    return this.viewer.getZoom()!;
  }

  zoomIn(): void {
    this.readyPromise.then(() => this.viewer.zoomIn());
  }

  zoomOut(): void {
    this.readyPromise.then(() => this.viewer.zoomOut());
  }

  getTableInfo(name: string): TableData {
    const table = this.tables.find((tableItem) => tableItem.name === name);
    if (table == null) {
      throw NO_TABLE;
    }
    return table.data();
  }

  setTablePos(name: string, xCord: number, yCord: number): void {
    const table = this.tables.find((tableItem) => tableItem.name === name);
    if (table == null) {
      throw NO_TABLE;
    }
    table.setTablePos(xCord, yCord);
  }

  private createAnnotations() {
    this.#annotations =
      this.schema?.annotations?.map(
        (annotationSchema) => new Annotation(annotationSchema)
      ) ?? [];
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string,
    newValue: string
  ): void {
    switch (name) {
      case "src":
        this.srcVal = newValue;
        void this.readyPromise.then(() => {
          void fetch(this.srcVal)
            .then((response) => response.json())
            .then((response) => {
              if (!validateJson(response)) {
                throw INVALID_SCHEMA;
              }
              this.notParsedSchema = cloneDeep<Schema>(response);
              this.tables = schemaParser(response);
              this.createAnnotations();

              return this.viewer.load(
                this.tables,
                this.#annotations,
                this.viewport ?? (response as Schema).viewport,
                this.notParsedSchema.arrangement ?? TableArrang.default,
                this.notParsedSchema.viewWidth,
                this.notParsedSchema.viewHeight
              );
            })
            .then(() => {
              this.dispatchEvent(new LoadEvent());
            });
        });
        break;
      case "disable-table-movement":
        if (this.hasAttribute("disable-table-movement")) {
          void this.readyPromise.then(() =>
            this.viewer.disableTableMovement(true)
          );
        } else {
          void this.readyPromise.then(() =>
            this.viewer.disableTableMovement(false)
          );
        }
        break;
      case "viewport":
        this.viewportVal = newValue as Viewport;
        if (this.viewer) void this.viewer.setViewport(this.viewportVal);
        break;
    }
  }
  private shadowDomLoaded(shadowDom: ShadowRoot): Promise<void> {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes) {
            resolve();
          }
        });
      });
      observer.observe(shadowDom, { childList: true });
    });
  }

  private whenWindowLoaded = (): void => {
    const shadowDom = this.attachShadow({
      mode: "open",
    });
    void this.shadowDomLoaded(shadowDom)
      .then(() => {
        this.viewer = new Viewer(shadowDom);
        this.viewer.setCallbacks({
          tableClick: this.onTableClick,
          tableContextMenu: this.onTableContextMenu,
          tableDblClick: this.onTableDblClick,
          tableMove: this.onTableMove,
          tableMoveEnd: this.onTableMoveEnd,
          relationClick: this.onRelationClick,
          relationDblClick: this.onRelationDblClick,
          relationContextMenu: this.onRelationContextMenu,
          viewportClick: this.onViewportClick,
          zoomIn: this.onZoomIn.bind(this),
          zoomOut: this.onZoomOut.bind(this),
        });
        return this.viewer.getViewLoaded();
      })
      .then(() => {
        this.readyPromiseResolve(null);
        this.dispatchEvent(new ReadyEvent());
      });
    shadowDom.innerHTML = template;
  };

  private checkWindowLoaded(): boolean {
    return document.readyState === "complete";
  }

  private onViewportClick = (x: number, y: number): void => {
    this.dispatchEvent(new ViewportClickEvent({ x, y }));
  };

  private onTableClick = (tableData: TableData): void => {
    this.dispatchEvent(new TableClickEvent(tableData));
  };

  private onTableDblClick = (tableData: TableData): void => {
    this.dispatchEvent(new TableDblClickEvent(tableData));
  };

  private onTableContextMenu = (tableData: TableData): void => {
    this.dispatchEvent(new TableContextMenuEvent(tableData));
  };

  private onTableMove = (tableData: TableData): void => {
    this.dispatchEvent(new TableMoveEvent(tableData));
  };

  private onTableMoveEnd = (tableData: TableData): void => {
    this.dispatchEvent(new TableMoveEndEvent(tableData));
  };

  private onRelationClick = (relationData: RelationData): void => {
    this.dispatchEvent(new RelationClickEvent(relationData));
  };

  private onRelationDblClick = (relationData: RelationData): void => {
    this.dispatchEvent(new RelationDblClickEvent(relationData));
  };

  private onRelationContextMenu = (relationData: RelationData): void => {
    this.dispatchEvent(new RelationContextMenuEvent(relationData));
  };

  private onZoomIn = (zoom: number): void => {
    this.dispatchEvent(new ZoomInEvent(zoom));
  };

  private onZoomOut = (zoom: number): void => {
    this.dispatchEvent(new ZoomOutEvent(zoom));
  };

  addEventListener<K extends keyof DbViewerEventMap>(
    type: K,
    listener: (this: DbViewer, ev: DbViewerEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener as EventListener, options);
  }
  removeEventListener<K extends keyof DbViewerEventMap>(
    type: K,
    listener: (this: HTMLFormElement, ev: DbViewerEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener as EventListener, options);
  }
}

customElements.define("db-viewer", DbViewer);

export * from "./types/schema";
export { default as Point } from "./types/point";
export * from "./events";
export default DbViewer;
