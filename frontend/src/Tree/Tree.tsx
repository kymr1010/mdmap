import { Accessor, createSignal } from "solid-js";
import { Node } from "../schema/CardNode.js";

// frontend/src/components/NodeTree/NodeTree.tsx
type TreeNode = {
  name: string;
  type: "file" | "folder";
  node: Node;
  children?: TreeNode[];
};

export const Tree = (props: { nodes: Accessor<Node[]> }) => {
  return (
    <ul style={{ listStyleType: "none", paddingLeft: "1rem" }}>
      {props.nodes().map((node, index) => (
        <TreeNode
          node={{
            name: node.card().title,
            type: node.card().type === "folder" ? "folder" : "file",
            node: node,
            children: node.children.map((child) => ({
              name: child.card().title,
              type: child.card().type === "folder" ? "folder" : "file",
              node: child,
            })),
          }}
        />
      ))}
    </ul>
  );
};

const TreeNode = (props: { node: TreeNode }) => {
  const [isOpen, setIsOpen] = createSignal(false);

  const toggleOpen = () => {
    if (props.node.type === "folder") {
      setIsOpen(!isOpen);
    }
  };

  return (
    <li>
      <div
        style={{ cursor: props.node.type === "folder" ? "pointer" : "default" }}
        onClick={toggleOpen}
      >
        {props.node.type === "folder" ? (isOpen() ? "📂" : "📁") : "📄"}{" "}
        {props.node.name}
      </div>
      {isOpen() && props.node.children && (
        <TreeNode
          node={{
            name: props.node.name,
            type: props.node.type,
            node: props.node.node,
            children: props.node.children,
          }}
        />
      )}
    </li>
  );
};
