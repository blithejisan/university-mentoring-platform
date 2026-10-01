const nodes = [
  [8, 18], [21, 32], [35, 15], [48, 28], [62, 12], [76, 29], [91, 17],
  [12, 62], [28, 78], [43, 58], [57, 76], [72, 57], [88, 78], [96, 54],
] as const;

const links = [
  [0, 1], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [5, 6],
  [7, 8], [7, 9], [8, 9], [9, 10], [9, 11], [10, 11], [11, 12], [11, 13],
  [1, 7], [3, 9], [4, 11], [5, 12],
] as const;

export function NeuralBackground() {
  return (
    <div className="neural-background" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {links.map(([from, to]) => (
          <line
            key={`link-${from}-${to}`}
            className="neural-link"
            x1={nodes[from][0]}
            y1={nodes[from][1]}
            x2={nodes[to][0]}
            y2={nodes[to][1]}
          />
        ))}
        {nodes.map(([x, y], index) => (
          <circle
            key={`node-${index}`}
            className="neural-node"
            cx={x}
            cy={y}
            r={index % 4 === 0 ? 0.55 : 0.35}
            fill={index % 3 === 0 ? "#a78bfa" : "#22d3ee"}
          />
        ))}
      </svg>
    </div>
  );
}
