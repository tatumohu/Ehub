const fs = require('fs');
let content = fs.readFileSync('src/pages/NetworkView.tsx', 'utf8');

// Change node size
content = content.replace(
  `const layout = d3.tree<NetworkNode>().nodeSize([cardWidth + 80, cardHeight + 120]);`,
  `const layout = d3.tree<NetworkNode>().nodeSize([cardHeight + 40, cardWidth + 160]);`
);

// Transform target node center
content = content.replace(
  `        .translate(-(targetNode as any).x, -(targetNode as any).y);`,
  `        .translate(-(targetNode as any).y, -(targetNode as any).x);`
);

// Links
content = content.replace(
  `        // Start from bottom of source card, end at top of target card
        // Use a small overlap to ensure no gaps
        const startY = s.y + cardHeight / 2 - 2;
        const endY = t.y - cardHeight / 2 + 2;
        
        // Orthogonal for tree mode
        const midY = (startY + endY) / 2;
        const tx = s.x === t.x ? t.x + 0.01 : t.x;
        
        // Same author: Vertical line (if possible, otherwise step)
        // Different author: L-shaped line (step)
        const isSameAuthor = s.data.author_name === t.data.author_name;
        
        if (isSameAuthor && Math.abs(s.x - t.x) < 1) {
          return \`M\${s.x},\${startY} L\${s.x},\${endY}\`;
        } else if (isSameAuthor) {
          // If same author but different X (due to layout), still use a more direct path or step
          return \`M\${s.x},\${startY} L\${s.x},\${midY} L\${tx},\${midY} L\${tx},\${endY}\`;
        } else {
          // Different author: L-shaped (Step)
          return \`M\${s.x},\${startY} L\${s.x},\${midY} L\${tx},\${midY} L\${tx},\${endY}\`;
        }`,
  `        // Horizontal left-to-right layout
        const startX = s.y + cardWidth / 2 - 2;
        const endX = t.y - cardWidth / 2 + 2;
        const midX = (startX + endX) / 2;
        const ty = s.x === t.x ? t.x + 0.01 : t.x;
        return \`M\${startX},\${s.x} L\${midX},\${s.x} L\${midX},\${ty} L\${endX},\${ty}\`;`
);

// Nodes
content = content.replace(
  `.attr('transform', d => \`translate(\${(d as any).x},\${(d as any).y})\`)`,
  `.attr('transform', d => \`translate(\${(d as any).y},\${(d as any).x})\`)`
);

// Add >> NEXT label in the links
const linkHtml = `    // Draw links
    const linkGroup = g.selectAll('.link-group')
      .data(root.links())
      .enter()
      .append('g')
      .attr('class', 'link-group');

    linkGroup.append('path')`;

content = content.replace(
  `    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')`,
  linkHtml
);

const arrowHtml = `      .style('opacity', 0.8);

    // Add NEXT text
    linkGroup.append('text')
      .attr('x', d => ((d.source as any).y + (d.target as any).y) / 2)
      .attr('y', d => ((d.source as any).x + (d.target as any).x) / 2 - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('>>');
      
    linkGroup.append('text')
      .attr('x', d => ((d.source as any).y + (d.target as any).y) / 2)
      .attr('y', d => ((d.source as any).x + (d.target as any).x) / 2 + 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text('NEXT');`;

content = content.replace(
  `      .style('opacity', 0.8);`,
  arrowHtml
);

fs.writeFileSync('src/pages/NetworkView.tsx', content);
