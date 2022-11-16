import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { StyledComponentProps } from "styled-components";
import G6, { Graph, GraphData } from "@antv/g6";
import { ActionButton } from "@fluentui/react";
import type { IFieldMeta } from "../../../interfaces";
import type { ModifiableBgKnowledge } from "../config";
import type { DiagramGraphData } from ".";


const GRAPH_HEIGHT = 400;

const G6_EDGE_SELECT = 'edge_select';

G6.registerBehavior(G6_EDGE_SELECT, {
    getEvents() {
        return {
            'edge:click': 'onEdgeClick',
        };
    },
    onEdgeClick(e: any) {
        const graph = this.graph as Graph;
        const item = e.item;
        if (item.hasState('active')) {
            graph.setItemState(item, 'active', false);
            return;
        }
        graph.findAllByState('edge', 'active').forEach(node => {
            graph.setItemState(node, 'active', false);
        });
        graph.setItemState(item, 'active', true);
    },
});

const Container = styled.div`
    overflow: hidden;
    position: relative;
    > div {
        width: 100%;
        height: 100%;
    }
    & .msg {
        position: absolute;
        left: 1em;
        top: 2em;
        font-size: 10px;
        user-select: none;
        pointer-events: none;
    }
`;

export type GraphViewProps = Omit<StyledComponentProps<'div', {}, {
    fields: readonly Readonly<IFieldMeta>[];
    selectedSubtree: readonly string[];
    value: Readonly<DiagramGraphData>;
    cutThreshold: number;
    mode: 'explore' | 'edit';
    focus: number | null;
    onClickNode?: (node: DiagramGraphData['nodes'][number]) => void;
    onLinkTogether: (srcFid: string, tarFid: string) => void;
    onRemoveLink: (srcFid: string, tarFid: string) => void;
    preconditions: ModifiableBgKnowledge[];
}, never>, 'onChange' | 'ref'>;

const arrows = {
    undirected: {
        start: '',
        end: '',
    },
    directed: {
        start: '',
        end: 'M 12,0 L 28,8 L 28,-8 Z',
    },
    bidirected: {
        start: 'M 12,0 L 28,8 L 28,-8 Z',
        end: 'M 12,0 L 28,8 L 28,-8 Z',
    },
    'weak directed': {
        start: '',
        end: 'M 12,0 L 18,6 L 24,0 L 18,-6 Z',
    },
} as const;

G6.registerEdge(
    'forbidden-edge',
    {
        afterDraw(cfg, group: any) {
            // 获取图形组中的第一个图形，在这里就是边的路径图形
            const shape = group.get('children')[0];
            // 获取路径图形的中点坐标
            const midPoint = shape.getPoint(0.5);
            group.addShape('path', {
                attrs: {
                    width: 10,
                    height: 10,
                    stroke: '#f00',
                    lineWidth: 2,
                    path: [
                        ['M', midPoint.x + 8, midPoint.y + 8],
                        ['L', midPoint.x - 8, midPoint.y - 8],
                        ['M', midPoint.x - 8, midPoint.y + 8],
                        ['L', midPoint.x + 8, midPoint.y - 8],
                    ],
                },
                name: 'forbidden-mark',
            });
        },
        update: undefined,
    },
    'line',
);

/** 调试用的，不需要的时候干掉 */
type ExportableGraphData = {
    nodes: { id: string }[];
    edges: { source: string; target: string }[];
};
/** 调试用的，不需要的时候干掉 */
const ExportGraphButton: React.FC<{ data: DiagramGraphData; fields: readonly Readonly<IFieldMeta>[] }> = ({ data, fields }) => {
    const value = useMemo<File>(() => {
        const graph: ExportableGraphData = {
            nodes: fields.map(f => ({ id: f.fid })),
            edges: [],
        };
        for (const link of data.links) {
            const source = fields[link.causeId].fid;
            const target = fields[link.effectId].fid;
            graph.edges.push({ source, target });
            if (link.type === 'bidirected' || link.type === 'undirected') {
                graph.edges.push({ source: target, target: source });
            }
        }
        return new File([JSON.stringify(graph, undefined, 2)], `test - ${new Date().toLocaleString()}.json`);
    }, [data, fields]);
    const dataUrlRef = useRef('');
    useEffect(() => {
        dataUrlRef.current = URL.createObjectURL(value);
        return () => {
            URL.revokeObjectURL(dataUrlRef.current);
        };
    }, [value]);
    const handleExport = useCallback(() => {
        const a = document.createElement('a');
        a.href = dataUrlRef.current;
        a.download = value.name;
        a.click();
        a.remove();
    }, [value.name]);
    return (
        <ActionButton iconProps={{ iconName: 'Download' }} onClick={handleExport} style={{ position: 'absolute', bottom: 0 }}>
            导出为图
        </ActionButton>
    );
};

const GraphView = forwardRef<HTMLDivElement, GraphViewProps>((
    { fields, selectedSubtree, value, onClickNode, focus, cutThreshold, mode, onLinkTogether, onRemoveLink, preconditions, ...props },
    ref
) => {
    const [forceUpdateFlag, setForceUpdateFlag] = useState(Date.now());

    const [data] = useMemo(() => {
        let totalScore = 0;
        const pos = forceUpdateFlag;
        const nodeCauseWeights = value.nodes.map(() => 0);
        const nodeEffectWeights = value.nodes.map(() => 0);
        value.links.forEach(link => {
            nodeCauseWeights[link.effectId] += link.score;
            nodeEffectWeights[link.causeId] += link.score;
            totalScore += link.score * 2;
        });
        return [{
            nodes: value.nodes.map((node, i) => ({
                id: node.nodeId,
                index: i,
                causeSum: nodeCauseWeights[i],
                effectSum: nodeEffectWeights[i],
                score: (nodeCauseWeights[i] + nodeEffectWeights[i]) / totalScore,
                diff: (nodeCauseWeights[i] - nodeEffectWeights[i]) / totalScore,
            })),
            links: value.links.map(link => ({
                source: link.causeId,
                target: link.effectId,
                value: link.score / nodeCauseWeights[link.effectId],
                type: link.type,
            })).filter(link => link.value >= cutThreshold),
        }, totalScore, pos];
    }, [value, cutThreshold, forceUpdateFlag]);

    const containerRef = useRef<HTMLDivElement>(null);

    const [width, setWidth] = useState(0);

    const handleNodeClickRef = useRef(onClickNode);
    handleNodeClickRef.current = onClickNode;

    const handleLinkRef = useRef(onLinkTogether);
    handleLinkRef.current = onLinkTogether;

    const handleRemoveLinkRef = useRef(onRemoveLink);
    handleRemoveLinkRef.current = onRemoveLink;

    const updateSelected = useRef((idx: number) => {});

    const graphRef = useRef<Graph>();
    const dataRef = useRef<GraphData>({});
    dataRef.current = useMemo(() => ({
        nodes: data.nodes.map((node, i) => {
            const isInSubtree = selectedSubtree.includes(fields[node.id].fid);
            return {
                id: `${node.id}`,
                description: fields[i].name ?? fields[i].fid,
                style: {
                    lineWidth: i === focus ? 3 : isInSubtree ? 2 : 1,
                    opacity: i === focus || isInSubtree ? 1 : focus === null ? 1 : 0.4,
                },
            };
        }),
        edges: mode === 'explore' ? data.links.map((link, i) => {
            const isInSubtree = focus !== null && [fields[link.source].fid, fields[link.target].fid].every(fid => {
                return [fields[focus].fid].concat(selectedSubtree).includes(fid);
            });
            return {
                id: `link_${i}`,
                source: `${link.source}`,
                target: `${link.target}`,
                style: {
                    lineWidth: isInSubtree ? 1.5 : 1,
                    opacity: focus === null ? 0.9 : isInSubtree ? 1 : 0.2,
                    startArrow: {
                        fill: '#F6BD16',
                        path: arrows[link.type].start,
                    },
                    endArrow: {
                        fill: '#F6BD16',
                        path: arrows[link.type].end,
                    },
                },
            };
        }) : preconditions.map((bk, i) => ({
            id: `bk_${i}`,
            source: `${fields.findIndex(f => f.fid === bk.src)}`,
            target: `${fields.findIndex(f => f.fid === bk.tar)}`,
            style: {
                lineWidth: 2,
                startArrow: {
                    fill: '#F6BD16',
                    path: '',
                },
                endArrow: {
                    fill: '#F6BD16',
                    path: 'M 12,0 L 28,8 L 28,-8 Z',
                },
            },
            edgeStateStyles: {
                active: {
                    lineWidth: 2,
                },
            },
            type: bk.type === 'must-not-link' ? 'forbidden-edge' : undefined,
        })),
    }), [data, mode, preconditions, fields, selectedSubtree, focus]);

    const widthRef = useRef(width);
    widthRef.current = width;

    const [edgeSelected, setEdgeSelected] = useState(false);

    useEffect(() => {
        const { current: container } = containerRef;
        if (container) {
            let createEdgeFrom = -1;
            const graph = new G6.Graph({
                container,
                width: widthRef.current,
                height: GRAPH_HEIGHT,
                linkCenter: true,
                modes: {
                    default: mode === 'edit' ? ['drag-canvas', {
                        type: 'create-edge',
                        trigger: 'drag',
                        shouldBegin(e) {
                            const source = e.item?._cfg?.id;
                            if (source) {
                                createEdgeFrom = parseInt(source, 10);
                            }
                            return true;
                        },
                        shouldEnd(e) {
                            const target = e.item?._cfg?.id;
                            if (target) {
                                const origin = fields[createEdgeFrom];
                                const destination = fields[parseInt(target, 10)];
                                if (origin.fid !== destination.fid) {
                                    handleLinkRef.current(origin.fid, destination.fid);
                                }
                            }
                            return false;
                        },
                    }, G6_EDGE_SELECT] : ['drag-canvas', 'drag-node', 'click-select'],
                },
                animate: true,
                layout: {
                    type: 'fruchterman',
                    gravity: 5,
                    speed: 5,
                    center: [widthRef.current / 2, GRAPH_HEIGHT / 2],
                    // for rendering after each iteration
                    tick: () => {
                        graph.refreshPositions()
                    }
                },
                defaultNode: {
                    size: 24,
                    style: {
                        lineWidth: 2,
                    },
                },
                defaultEdge: {
                    size: 1,
                    color: '#F6BD16',
                },
            });
            graph.node(node => ({
                label: node.description ?? node.id,
            }));
            graph.data(dataRef.current);
            graph.render();

            graph.on('nodeselectchange', (e: any) => {
                const selected = e.selectedItems.nodes[0]?._cfg.id;
                const idx = selected === undefined ? null : parseInt(selected, 10);

                if (idx !== null) {
                    handleNodeClickRef.current?.({ nodeId: idx });
                }
            });

            graph.on('keydown', e => {
                if (e.key === 'Backspace') {
                    // delete selected link
                    const [selectedEdge] = graph.findAllByState('edge', 'active');
                    if (selectedEdge) {
                        const src = (selectedEdge._cfg?.source as any)?._cfg.id;
                        const tar = (selectedEdge._cfg?.target as any)?._cfg.id;
                        if (src && tar) {
                            const srcF = fields[parseInt(src, 10)];
                            const tarF = fields[parseInt(tar, 10)];
                            handleRemoveLinkRef.current(srcF.fid, tarF.fid);
                        }
                    }
                }
            });

            graph.on('click', () => {
                setTimeout(() => {
                    const [selectedEdge] = graph.findAllByState('edge', 'active');
                    setEdgeSelected(Boolean(selectedEdge));
                }, 1);
            });

            setEdgeSelected(false);

            updateSelected.current = idx => {
                const prevSelected = graph.findAllByState('node', 'selected')[0]?._cfg?.id;
                const prevSelectedIdx = prevSelected ? parseInt(prevSelected, 10) : null;

                if (prevSelectedIdx === idx) {
                    return;
                } else if (prevSelectedIdx !== null) {
                    graph.setItemState(`${prevSelectedIdx}`, 'selected', false);
                }
                graph.setItemState(`${idx}`, 'selected', true);
            };

            graphRef.current = graph;

            return () => {
                graphRef.current = undefined;
                container.innerHTML = '';
            };
        }
    }, [mode, fields]);

    useEffect(() => {
        if (graphRef.current) {
            graphRef.current.changeSize(width, GRAPH_HEIGHT);
            graphRef.current.updateLayout({
                type: 'fruchterman',
                gravity: 5,
                speed: 5,
                center: [widthRef.current / 2, GRAPH_HEIGHT / 2],
                // for rendering after each iteration
                tick: () => {
                    graphRef.current?.refreshPositions();
                }
            });
            graphRef.current.render();
        }
    }, [width]);

    useEffect(() => {
        const { current: container } = containerRef;
        const { current: graph } = graphRef;
        if (container && graph) {
            graph.data(dataRef.current);
            // const edges = graph.save().edges;
            // G6.Util.processParallelEdges(edges);
            // graph.getEdges().forEach((edge, i) => {
            //     graph.updateItem(edge, {
            //         // @ts-ignore
            //         curveOffset: edges[i].curveOffset,
            //         // @ts-ignore
            //         curvePosition: edges[i].curvePosition,
            //     });
            // });
            // console.log({edges})
            graph.render();
        }
    }, [data, preconditions, selectedSubtree]);

    useEffect(() => {
        if (focus !== null) {
            updateSelected.current(focus);
        }
    }, [focus]);

    useEffect(() => {
        const { current: container } = containerRef;
        if (container) {
            const cb = () => {
                const { width: w } = container.getBoundingClientRect();
                setWidth(w);
            };
            const ro = new ResizeObserver(cb);
            ro.observe(container);
            return () => {
                ro.disconnect();
            };
        }
    }, []);

    return (
        <Container
            {...props}
            ref={ref}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => {
                e.stopPropagation();
                setForceUpdateFlag(Date.now());
            }}
        >
            <div ref={containerRef} />
            {/* {edgeSelected && <p className="msg">Press Backspace key to remove this edge.</p>} */}
            {edgeSelected && <p className="msg">按下 Backspace 键删除这条关系</p>}
            <ExportGraphButton fields={fields} data={value} />
        </Container>
    );
});


export default GraphView;
