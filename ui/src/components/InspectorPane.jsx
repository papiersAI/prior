import React, { useMemo } from "react";
import { describeActivity } from "./TrajectoryRail.jsx";
import { buildTreeModel, lineageFor } from "./treeModel.js";

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isExternal(ref = "") {
  return /^https?:\/\//.test(ref);
}

function ReceiptRow({ receipt, onReceiptClick }) {
  const external = isExternal(receipt.ref);
  const content = (
    <>
      <span className="receipt-source">{external ? domainOf(receipt.ref) : receipt.ref}</span>
      {receipt.quote && <span className="receipt-quote">{receipt.quote}</span>}
    </>
  );

  if (external) {
    return (
      <a className="inspector-receipt" href={receipt.ref} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }
  return (
    <button className="inspector-receipt" type="button" onClick={() => onReceiptClick(receipt)}>
      {content}
    </button>
  );
}

function InspectorSection({ title, count, children }) {
  return (
    <section className="inspector-section">
      <header>
        <span>{title}</span>
        {count != null && <strong>{count}</strong>}
      </header>
      {children}
    </section>
  );
}

function NodeInspector({ node, model, onReceiptClick, onSelectNode }) {
  const evidence = model.evidenceBy.get(node.id) ?? [];
  const evaluations = model.evalsBy.get(node.id) ?? [];
  const children = model.childrenBy.get(node.id) ?? [];
  const lineage = lineageFor(node, model.byId);
  const directReceipts = node.receipts ?? [];
  const libraryReceipts = directReceipts.filter((receipt) => !isExternal(receipt.ref));
  const externalReceipts = directReceipts.filter((receipt) => isExternal(receipt.ref));
  const checkpoints = node.scoreCheckpoints ?? (node.score == null ? [] : [{ score: node.score, status: node.status ?? "frontier", stage: "generated" }]);
  const generatedScore = checkpoints[0]?.score;
  const evaluatedCheckpoint = [...checkpoints].reverse().find((checkpoint) => checkpoint.stage === "evaluated" || checkpoint.stage === "pruned");
  const highSignal = node.kind === "idea" && node.score >= 8 && node.status === "expanded";

  if (node.kind === "root") {
    return (
      <>
        <div className="inspector-kicker"><span>Research objective</span></div>
        <h2 id="inspector-title">{node.text}</h2>
      </>
    );
  }

  if (node.kind === "seed") {
    return (
      <>
        <div className="inspector-kicker"><span>Unread save selected as seed</span></div>
        <h2 id="inspector-title">{node.text}</h2>
        {node.url && (
          <InspectorSection title="Library receipt">
            <ReceiptRow receipt={{ ref: node.url, quote: node.text }} onReceiptClick={onReceiptClick} />
          </InspectorSection>
        )}
      </>
    );
  }

  return (
    <>
      <div className="inspector-kicker">
        <span>{node.status === "expanding" ? "Currently evaluating" : node.status === "pruned" ? "Pruned idea" : "Research idea"}</span>
        {highSignal && <strong>High signal</strong>}
      </div>
      <h2 id="inspector-title">{node.text}</h2>

      <div className="score-history" aria-label="Expected value score history">
        <div>
          <span>Expected value</span>
          <strong>{node.score ?? "—"}</strong>
        </div>
        <p>
          {evaluatedCheckpoint
            ? `Generated ${generatedScore}; after deep dive ${evaluatedCheckpoint.score} (${evaluatedCheckpoint.score === generatedScore ? "retained" : evaluatedCheckpoint.score > generatedScore ? "raised" : "lowered"})`
            : node.status === "expanding"
              ? `Generated ${generatedScore}; deep dive in progress`
              : `Generated EV ${generatedScore}; awaiting deep dive`}
        </p>
      </div>

      {lineage.length > 1 && (
        <InspectorSection title="Lineage" count={lineage.length - 1}>
          <div className="lineage-list">
            {lineage.map((ancestor, index) => (
              <React.Fragment key={ancestor.id}>
                {ancestor.kind === "idea" && ancestor.id !== node.id ? (
                  <button type="button" onClick={() => onSelectNode(ancestor.id)}>{ancestor.text}</button>
                ) : (
                  <span>{ancestor.text}</span>
                )}
                {index < lineage.length - 1 && <b aria-hidden="true">/</b>}
              </React.Fragment>
            ))}
          </div>
        </InspectorSection>
      )}

      {node.detail && (
        <InspectorSection title="Approach">
          <p className="inspector-prose">{node.detail}</p>
        </InspectorSection>
      )}

      {evaluations.length > 0 && (
        <InspectorSection title="Evaluator rationale" count={evaluations.length}>
          <div className="evaluation-list">
            {evaluations.map((evaluation) => (
              <article key={evaluation.id}>
                <p>{evaluation.text}</p>
                {evaluation.detail && <div><span>Risks</span><p>{evaluation.detail}</p></div>}
              </article>
            ))}
          </div>
        </InspectorSection>
      )}

      {libraryReceipts.length > 0 && (
        <InspectorSection title="From your library" count={libraryReceipts.length}>
          <div className="receipt-list">
            {libraryReceipts.map((receipt, index) => (
              <ReceiptRow key={`${receipt.ref}-${index}`} receipt={receipt} onReceiptClick={onReceiptClick} />
            ))}
          </div>
        </InspectorSection>
      )}

      {(externalReceipts.length > 0 || evidence.length > 0) && (
        <InspectorSection title="Discovered evidence" count={externalReceipts.length + evidence.length}>
          <div className="receipt-list">
            {externalReceipts.map((receipt, index) => (
              <ReceiptRow key={`${receipt.ref}-${index}`} receipt={receipt} onReceiptClick={onReceiptClick} />
            ))}
            {evidence.map((source) => (
              <ReceiptRow
                key={source.id}
                receipt={{ ref: source.url ?? source.text, quote: source.text }}
                onReceiptClick={onReceiptClick}
              />
            ))}
          </div>
        </InspectorSection>
      )}

      {children.length > 0 && (
        <InspectorSection title="Sharper children" count={children.length}>
          <div className="child-idea-list">
            {children.map((child) => (
              <button key={child.id} type="button" onClick={() => onSelectNode(child.id)}>
                <span>{child.text}</span>
                <strong>EV {child.score}</strong>
              </button>
            ))}
          </div>
        </InspectorSection>
      )}
    </>
  );
}

function ActivityInspector({ item, nodes, onReceiptClick, onSelectNode }) {
  const description = describeActivity(item, nodes);
  const longOutput = description.text.length > 180;
  const node = item.node;
  const relatedId = item.nodeId ?? (node?.parentId && nodes.some((candidate) => candidate.id === node.parentId && candidate.kind === "idea") ? node.parentId : null);
  const receipts = [...(node?.receipts ?? [])];
  if (node?.url && !receipts.some((receipt) => receipt.ref === node.url)) {
    receipts.push({ ref: node.url, quote: node.text });
  }

  return (
    <>
      <div className="inspector-kicker"><span>{description.label}</span></div>
      <h2 id="inspector-title">{longOutput ? `${description.label} emitted` : description.text}</h2>

      {longOutput && (
        <InspectorSection title="Agent output">
          <p className="inspector-prose">{description.text}</p>
        </InspectorSection>
      )}

      {node?.detail && (
        <InspectorSection title="Emitted rationale">
          <p className="inspector-prose">{node.detail}</p>
        </InspectorSection>
      )}

      {item.t === "node" && item.run === "prior" && node?.kind === "direction" && (
        <InspectorSection title="Decision state">
          <div className="decision-state">
            <span>Working set</span>
            <strong>Awaiting tree promotion</strong>
          </div>
        </InspectorSection>
      )}

      {receipts.length > 0 && (
        <InspectorSection title="Receipts" count={receipts.length}>
          <div className="receipt-list">
            {receipts.map((receipt, index) => (
              <ReceiptRow key={`${receipt.ref}-${index}`} receipt={receipt} onReceiptClick={onReceiptClick} />
            ))}
          </div>
        </InspectorSection>
      )}

      {relatedId && (
        <button className="open-related-idea" type="button" onClick={() => onSelectNode(relatedId)}>
          Open related idea
        </button>
      )}
    </>
  );
}

export default function InspectorPane({
  selection,
  nodes,
  pinned,
  onClose,
  onResumeLive,
  onSelectNode,
  onReceiptClick,
}) {
  const model = useMemo(() => buildTreeModel(nodes, null), [nodes]);
  if (!selection) return null;

  const selectedNode = selection.kind === "node" ? model.byId.get(selection.id) : null;
  const sourceNode = selection.kind === "source" ? selection.node : null;

  return (
    <aside className="inspector-pane" aria-labelledby="inspector-title">
      <header className="inspector-header">
        <span>Inspector</span>
        <div>
          {pinned && <button type="button" onClick={onResumeLive}>Follow live</button>}
          <button type="button" onClick={onClose} aria-label="Close inspector">Close</button>
        </div>
      </header>
      <div className="inspector-body">
        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            model={model}
            onReceiptClick={onReceiptClick}
            onSelectNode={onSelectNode}
          />
        )}
        {sourceNode && (
          <NodeInspector
            node={{ ...sourceNode, kind: "seed" }}
            model={model}
            onReceiptClick={onReceiptClick}
            onSelectNode={onSelectNode}
          />
        )}
        {selection.kind === "activity" && (
          <ActivityInspector
            item={selection.item}
            nodes={nodes}
            onReceiptClick={onReceiptClick}
            onSelectNode={onSelectNode}
          />
        )}
      </div>
    </aside>
  );
}
