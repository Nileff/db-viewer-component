import constant from '../const';
import {
  segmentIntersection,
} from '../mathUtil';
import Table from '../Table';
import { Column } from '../types/Column';
import Orientation from '../types/Orientation';
import Vertices from '../types/Vertices';
import Point from '../types/Point';
import selfRelationLeft from './selfRelationLeft';
import threeLinePathHoriz from './threeLinePathHoriz';
import twoLinePathFlatTop from './twoLinePathFlatTop';
import twoLinePathFlatBottom from './twoLinePathFlatBottom';
import selfRelationRight from './selfRelationRight';
import selfRelationTop from './selfRelationTop';
import threeLinePathVert from './threeLinePathVert';
import selfRelationBottom from './selfRelationBottom';

enum Axis {
  x = 'x',
  y = 'y',
}

interface BasicRelation {
  fromColumn: Column;
  fromTable: Table;
  toColumn: Column;
  toTable: Table;
}
export default class Relation {

  public static ySort(arr: Relation[], table: Table): void {
    Relation.sort(arr, table, Axis.y);
  }

  public static xSort(arr: Relation[], table: Table): void {
    Relation.sort(arr, table, Axis.x);
  }

  private static sort(arr: Relation[], table: Table, axis: Axis): void {
    arr.sort((r1, r2) => {
      if (r1.fromIntersectPoint == null || r2.fromIntersectPoint == null) {
        return -1;
      }
      if (r1.fromTable === table) {
        if (r2.fromTable === table) {
          return r1.fromIntersectPoint[axis] - r2.fromIntersectPoint[axis];
        }
        return r1.fromIntersectPoint[axis] - r2.toIntersectPoint![axis];
      } else {
        if (r2.fromTable === table) {
          return r1.toIntersectPoint![axis] - r2.fromIntersectPoint[axis];
        }
        return r1.toIntersectPoint![axis] - r2.toIntersectPoint![axis];
      }
    });
  }
  public fromColumn: Column;
  public fromPathCount?: number;
  public fromPathIndex?: number;
  public fromTable: Table;
  public toColumn: Column;
  public toPathCount?: number;
  public toPathIndex?: number;
  public toTable: Table;
  public pathElem?: SVGGraphicsElement;
  public highlightTrigger?: SVGGraphicsElement;
  public fromTablePathSide?: Orientation;
  public toTablePathSide?: Orientation;
  public fromIntersectPoint?: Point;
  public toIntersectPoint?: Point;

  constructor({
    fromColumn,
    fromTable,
    toColumn,
    toTable,
  }: BasicRelation) {
    this.fromColumn = fromColumn;
    this.fromTable = fromTable;
    this.toColumn = toColumn;
    this.toTable = toTable;
  }

  public update(): void {
    this.getTableRelationSide();
  }

  public removeHoverEffect(): void {
    this.onMouseLeave();
  }

  public render(): [SVGGraphicsElement?, SVGGraphicsElement?] {
    const fromTableVertices = this.fromTable.getVertices();
    const toTableVertices = this.toTable.getVertices();

    const toMany = !this.fromColumn.uq;

    type StartEndMethod = (tableVertices: Vertices, pathIndex: number, pathCount: number) => Point;

    let startMethod: StartEndMethod;
    let endMethod: StartEndMethod;
    let resultMethod: (start: Point, end: Point, oneTo?: boolean, toMany?: boolean) => string;

    switch (this.fromTablePathSide) {
      case Orientation.Left:
        {
          startMethod = this.getLeftSidePathCord;
          switch (this.toTablePathSide) {
            case Orientation.Left:
              endMethod = this.getLeftSidePathCord;
              resultMethod = selfRelationLeft;
              break;
            case Orientation.Right:
              endMethod = this.getRightSidePathCord;
              resultMethod = threeLinePathHoriz;
              break;
            case Orientation.Top:
              endMethod = this.getTopSidePathCord;
              resultMethod = twoLinePathFlatTop;
              break;
            case Orientation.Bottom:
              endMethod = this.getBottomSidePathCord;
              resultMethod = twoLinePathFlatBottom;
              break;
          }
        }
        break;
      case Orientation.Right:
        {
          startMethod = this.getRightSidePathCord;
          switch (this.toTablePathSide) {
            case Orientation.Left:
              endMethod = this.getLeftSidePathCord;
              resultMethod = threeLinePathHoriz;
              break;
            case Orientation.Right:
              endMethod = this.getRightSidePathCord;
              resultMethod = selfRelationRight;
              break;
            case Orientation.Top:
              endMethod = this.getTopSidePathCord;
              resultMethod = twoLinePathFlatTop;
              break;
            case Orientation.Bottom:
              endMethod = this.getBottomSidePathCord;
              resultMethod = twoLinePathFlatBottom;
              break;
          }
        }
        break;
      case Orientation.Top:
        {
          startMethod = this.getTopSidePathCord;
          switch (this.toTablePathSide) {
            case Orientation.Left:
              endMethod = this.getLeftSidePathCord;
              resultMethod = twoLinePathFlatTop;
              break;
            case Orientation.Right:
              endMethod = this.getRightSidePathCord;
              resultMethod = twoLinePathFlatTop;
              break;
            case Orientation.Top:
              endMethod = this.getTopSidePathCord;
              resultMethod = selfRelationTop;
              break;
            case Orientation.Bottom:
              endMethod = this.getBottomSidePathCord;
              resultMethod = threeLinePathVert;
              break;
          }
        }
        break;
      case Orientation.Bottom:
        {
          startMethod = this.getBottomSidePathCord;
          switch (this.toTablePathSide) {
            case Orientation.Left:
              endMethod = this.getLeftSidePathCord;
              resultMethod = twoLinePathFlatBottom;
              break;
            case Orientation.Right:
              endMethod = this.getRightSidePathCord;
              resultMethod = twoLinePathFlatBottom;
              break;
            case Orientation.Top:
              endMethod = this.getTopSidePathCord;
              resultMethod = threeLinePathVert;
              break;
            case Orientation.Bottom:
              endMethod = this.getBottomSidePathCord;
              resultMethod = selfRelationBottom;
              break;
          }
        }
        break;
    }

    // In case of tables overlapping there won't be any result
    if (startMethod! && endMethod!) {
      const start = startMethod!.call(this, fromTableVertices, this.fromPathIndex!, this.fromPathCount!);
      const end = endMethod!.call(this, toTableVertices, this.toPathIndex!, this.toPathCount!);
      const result = resultMethod!.call(this, start, end, this.fromColumn.nn, toMany);
      const path = this.createPath(result);
      const highlight = this.createHighlightTrigger(result);
      this.setElems(path, highlight);
    }
    if (!this.pathElem) {
      return [];
    }
    return [this.highlightTrigger, this.pathElem];
  }

  public sameTableRelation(): boolean {
    return this.fromTable === this.toTable;
  }

  public calcPathTableSides(): boolean {
    if (this.fromTable === this.toTable) {
      return true;
    }
    const fromTableCenter = this.fromTable.getCenter();
    const toTableCenter = this.toTable.getCenter();

    const fromTableSides = this.fromTable.getVertices();

    const intersectFromTableRightSide =
      segmentIntersection(fromTableCenter, toTableCenter, fromTableSides.topRight, fromTableSides.bottomRight);
    if (intersectFromTableRightSide) {
      this.fromIntersectPoint = intersectFromTableRightSide;
      this.fromTablePathSide = Orientation.Right;
    }
    const intersectFromTableLeftSide =
      segmentIntersection(fromTableCenter, toTableCenter, fromTableSides.topLeft, fromTableSides.bottomLeft);
    if (intersectFromTableLeftSide) {
      this.fromIntersectPoint = intersectFromTableLeftSide;
      this.fromTablePathSide = Orientation.Left;
    }
    const intersectFromTableTopSide =
      segmentIntersection(fromTableCenter, toTableCenter, fromTableSides.topLeft, fromTableSides.topRight);
    if (intersectFromTableTopSide) {
      this.fromIntersectPoint = intersectFromTableTopSide;
      this.fromTablePathSide = Orientation.Top;
    }
    const intersectFromTableBottomSide =
      segmentIntersection(fromTableCenter, toTableCenter, fromTableSides.bottomLeft, fromTableSides.bottomRight);
    if (intersectFromTableBottomSide) {
      this.fromIntersectPoint = intersectFromTableBottomSide;
      this.fromTablePathSide = Orientation.Bottom;
    }

    const toTableSides = this.toTable.getVertices();

    const intersectToTableRightSide =
      segmentIntersection(fromTableCenter, toTableCenter, toTableSides.topRight, toTableSides.bottomRight);
    if (intersectToTableRightSide) {
      this.toIntersectPoint = intersectToTableRightSide;
      this.toTablePathSide = Orientation.Right;
    }
    const intersectToTableLeftSide =
      segmentIntersection(fromTableCenter, toTableCenter, toTableSides.topLeft, toTableSides.bottomLeft);
    if (intersectToTableLeftSide) {
      this.toIntersectPoint = intersectToTableLeftSide;
      this.toTablePathSide = Orientation.Left;
    }
    const intersectToTableTopSide =
      segmentIntersection(fromTableCenter, toTableCenter, toTableSides.topLeft, toTableSides.topRight);
    if (intersectToTableTopSide) {
      this.toIntersectPoint = intersectToTableTopSide;
      this.toTablePathSide = Orientation.Top;
    }
    const intersectToTableBottomSide =
      segmentIntersection(fromTableCenter, toTableCenter, toTableSides.bottomRight, toTableSides.bottomLeft);
    if (intersectToTableBottomSide) {
      this.toIntersectPoint = intersectToTableBottomSide;
      this.toTablePathSide = Orientation.Bottom;
    }
    return false;
  }

  public getElems(): Element[] {
    if (!this.pathElem) {
      return [];
    }
    return [this.pathElem, this.highlightTrigger!];
  }

  private getTableRelationSide(): never {
    throw new Error('Method not implemented.');
  }

  private getPosOnLine(pathIndex: number, pathCount: number, sideLength: number): number {
    return (pathIndex + 1) * (sideLength / (pathCount + 1));
  }

  private getLeftSidePathCord = (tableVertices: Vertices, pathIndex: number, pathCount: number): Point => {
    const sideLength = tableVertices.bottomLeft.y - tableVertices.topLeft.y;
    const posOnLine = this.getPosOnLine(pathIndex, pathCount, sideLength);
    return {
      x: tableVertices.topLeft.x,
      y: tableVertices.topLeft.y + posOnLine,
    };
  }

  private getRightSidePathCord = (tableVertices: Vertices, pathIndex: number, pathCount: number): Point => {
    const sideLength = tableVertices.bottomRight.y - tableVertices.topRight.y;
    const posOnLine = this.getPosOnLine(pathIndex, pathCount, sideLength);
    return {
      x: tableVertices.topRight.x,
      y: tableVertices.topRight.y + posOnLine,
    };
  }

  private getTopSidePathCord = (tableVertices: Vertices, pathIndex: number, pathCount: number): Point => {
    const sideLength = tableVertices.topRight.x - tableVertices.topLeft.x;
    const posOnLine = this.getPosOnLine(pathIndex, pathCount, sideLength);
    return {
      x: tableVertices.topLeft.x + posOnLine,
      y: tableVertices.topLeft.y,
    };
  }

  private getBottomSidePathCord = (tableVertices: Vertices, pathIndex: number, pathCount: number): Point => {
    const sideLength = tableVertices.bottomRight.x - tableVertices.bottomLeft.x;
    const posOnLine = this.getPosOnLine(pathIndex, pathCount, sideLength);
    return {
      x: tableVertices.bottomLeft.x + posOnLine,
      y: tableVertices.bottomLeft.y,
    };
  }

  private onMouseEnter(): void {
    this.pathElem!.classList.add('pathHover');
    this.fromTable.highlightFrom(this.fromColumn);
    this.toTable.highlightTo(this.toColumn);
  }

  private onMouseLeave(): void {
    if (this.pathElem) {
      this.pathElem.classList.remove('pathHover');
      this.fromTable.removeHighlightFrom(this.fromColumn);
      this.toTable.removeHighlightTo(this.toColumn);
    }
  }

  private setElems(elem: SVGGraphicsElement, highlightTrigger: SVGGraphicsElement): void {
    this.pathElem = elem;
    this.highlightTrigger = highlightTrigger;
    highlightTrigger.onmouseenter = this.onMouseEnter.bind(this);
    highlightTrigger.onmouseleave = this.onMouseLeave.bind(this);
  }

  private createHighlightTrigger(d: string): SVGGraphicsElement {
    const path = document.createElementNS(constant.nsSvg, 'path') as SVGGraphicsElement;
    path.setAttributeNS(null, 'd', d);
    path.classList.add('highlight');

    return path;
  }

  private createPath(d: string): SVGGraphicsElement {
    const path = document.createElementNS(constant.nsSvg, 'path') as SVGGraphicsElement;

    path.setAttributeNS(null, 'd', d);

    return path;
  }
}
