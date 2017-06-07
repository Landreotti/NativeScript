import { getSetProperties, getComputedCssValues } from "../ui/core/properties";
import { PercentLength, Length } from "../ui/styling/style-properties";
import { ViewBase } from "../ui/core/view";
import { Color } from "../color";
import { CSSComputedStyleProperty } from "./css-agent";

const propertyBlacklist = [
    "effectivePaddingLeft",
    "effectivePaddingBottom",
    "effectivePaddingRight",
    "effectivePaddingTop",
    "effectiveBorderTopWidth",
    "effectiveBorderRightWidth",
    "effectiveBorderBottomWidth",
    "effectiveBorderLeftWidth",
    "effectiveMinWidth",
    "nodeName",
    "nodeType",
    "decodeWidth",
    "decodeHeight"
]

export interface Inspector {
    childNodeInserted(parentId: number, lastId: number, nodeStr: string);
    childNodeRemoved(parentId: number, nodeId: number);
    documentUpdated();
    attributeModified(nodeId: number, attrName: string, attrValue: string);
    attributeRemoved(nodeId: number, attrName: string);
}

let inspector: Inspector;

function getInspector(): Inspector {
    if (!inspector) {
        inspector = (<any>global).__inspector;
    }

    return inspector;
}

export const ELEMENT_NODE_TYPE = 1;
export const ROOT_NODE_TYPE = 9;
export class DOMNode {
    nodeId;
    nodeType;
    nodeName;
    localName;
    nodeValue = '';
    attributes: string[] = [];

    constructor(private view: ViewBase) {
        this.nodeType = view.typeName === "Frame" ? ROOT_NODE_TYPE : ELEMENT_NODE_TYPE;
        this.nodeId = view._domId;
        this.nodeName = view.typeName;
        this.localName = this.nodeName;

        this.getAttributes(view, this.attributes);
    }

    get children(): DOMNode[] {
        const res = [];
        this.view.eachChild((child) => {
            child.ensureDomNode();
            res.push(child.domNode);
            return true;
        });

        return res;
    }

    public print() {
        return {
            nodeId: this.nodeId,
            nodeType: this.nodeType,
            nodeName: this.nodeName,
            localName: this.localName,
            nodeValue: this.nodeValue,
            children: this.children.map(c => c.print()),
            attributes: this.attributes
        };
    };

    public toJSON() {
        return JSON.stringify(this.print());
    }

    public getAttributes(view, attrs) {
        const props = getSetProperties(view).filter(pair => {
            const name = pair[0];
            const value = pair[1];

            if (name[0] === "_") {
                return false;
            }

            if (value !== null && typeof value === "object") {
                return false;
            }

            if (propertyBlacklist.indexOf(name) >= 0) {
                return false;
            }

            return true;
        });

        props.forEach(pair => attrs.push(pair[0], pair[1] + ""));
    }


    onChildAdded(view: ViewBase, atIndex?: number): void {
        const ins = getInspector();
        if (ins) {
            let previousChild: ViewBase;
            this.view.eachChild((child) => {
                if (child === view) {
                    return false;
                }

                previousChild = child;

                return true;
            });

            view.ensureDomNode();
            ins.childNodeInserted(this.nodeId, !!previousChild ? previousChild._domId : 0, view.domNode.toJSON());
        }
    }

    onChildRemoved(view: ViewBase): void {
        const ins = getInspector();
        if (ins) {
            ins.childNodeRemoved(this.nodeId, view.domNode.nodeId);
        }
    }

    getComputedProperties(): CSSComputedStyleProperty[] {
        const result = getComputedCssValues(this.view)
            .filter(pair => pair[0][0] !== "_")
            .map((pair) => {
                return {
                    name: pair[0],
                    value: valueToString(pair[1])
                };
            });
        return result;
    }

    attributeModified(name: string, value: any) {
        const ins = getInspector();
        if (ins) {
            ins.attributeModified(this.nodeId, name, valueToString(value));
        }
    }

    attributeRemoved(name: string) {
        const ins = getInspector();
        if (ins) {
            ins.attributeRemoved(this.nodeId, name);
        }
    }
}

function valueToString(value: any): string {
    if (typeof value === "undefined" || value === null) {
        return "";
    } else if (value instanceof Color) {
        return value.toString()
    } else if (typeof value === "object") {
        return PercentLength.convertToString(value)
    } else {
        return value + "";
    }
}
