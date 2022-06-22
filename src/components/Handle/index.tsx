import React, { memo, useContext, HTMLAttributes, forwardRef } from 'react';
import cc from 'classcat';
import shallow from 'zustand/shallow';

import { useStore, useStoreApi } from '../../store';
import NodeIdContext from '../../contexts/NodeIdContext';
import { HandleProps, Connection, ReactFlowState, Position, Edge } from '../../types';
import { checkElementBelowIsValid, handleMouseDown } from './handler';
import { getHostForElement } from '../../utils';
import { addEdge } from '../../utils/graph';

const alwaysValid = () => true;

export type HandleComponentProps = HandleProps & Omit<HTMLAttributes<HTMLDivElement>, 'id'>;

const selector = (s: ReactFlowState) => ({
  onConnectAction: s.onConnect,
  onConnectStart: s.onConnectStart,
  onConnectStop: s.onConnectStop,
  onConnectEnd: s.onConnectEnd,
  onClickConnectStart: s.onClickConnectStart,
  onClickConnectStop: s.onClickConnectStop,
  onClickConnectEnd: s.onClickConnectEnd,
  connectionMode: s.connectionMode,
  connectionStartHandle: s.connectionStartHandle,
  connectOnClick: s.connectOnClick,
  hasDefaultEdges: s.hasDefaultEdges,
});

const Handle = forwardRef<HTMLDivElement, HandleComponentProps>(
  (
    {
      type = 'source',
      position = Position.Top,
      isValidConnection = alwaysValid,
      isConnectable = true,
      maxConnections,
      id,
      color,
      onConnect,
      children,
      className,
      onMouseDown,
      ...rest
    },
    ref
  ) => {
    const store = useStoreApi();
    const nodeId = useContext(NodeIdContext) as string;
    const {
      onConnectAction,
      onConnectStart,
      onConnectStop,
      onConnectEnd,
      onClickConnectStop,
      onClickConnectEnd,
      connectionMode,
      connectionStartHandle,
      connectOnClick,
      hasDefaultEdges,
    } = useStore(selector, shallow);

    const handleId = id || null;
    const handleColor = color || null;
    const isTarget = type === 'target';
    const { edges } = store.getState();

    const connections = edges.filter((edge: Edge) => edge.target === nodeId);

    console.log(nodeId, {
      isTarget,
      edges,
      nodeId,
      maxConnections,
      connections,
    });

    if (!isTarget && maxConnections && connections.length >= maxConnections) {
      isConnectable = false;
    }

    const onConnectExtended = (params: Connection) => {
      const { defaultEdgeOptions } = store.getState();

      const edgeParams = {
        ...defaultEdgeOptions,
        ...params,
      };
      if (hasDefaultEdges) {
        const { edges } = store.getState();
        store.setState({ edges: addEdge(edgeParams, edges) });
      }

      onConnectAction?.(edgeParams);
      onConnect?.(edgeParams);
    };

    const onMouseDownHandler = (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button === 0) {
        handleMouseDown(
          event,
          handleId,
          nodeId,
          store.setState,
          onConnectExtended,
          isTarget,
          isValidConnection,
          connectionMode,
          undefined,
          undefined,
          onConnectStart,
          onConnectStop,
          onConnectEnd
        );
      }
      onMouseDown?.(event);
    };

    const onClick = (event: React.MouseEvent) => {
      if (!connectionStartHandle) {
        store.setState({ connectionStartHandle: { nodeId, type, handleId } });
        return;
      }

      const doc = getHostForElement(event.target as HTMLElement);
      const { connection, isValid } = checkElementBelowIsValid(
        event as unknown as MouseEvent,
        connectionMode,
        connectionStartHandle.type === 'target',
        connectionStartHandle.nodeId,
        connectionStartHandle.handleId || null,
        isValidConnection,
        doc
      );

      onClickConnectStop?.(event as unknown as MouseEvent);

      if (isValid) {
        onConnectExtended(connection);
      }

      onClickConnectEnd?.(event as unknown as MouseEvent);

      store.setState({ connectionStartHandle: null });
    };

    const handleClasses = cc([
      'react-flow__handle',
      `react-flow__handle-${position}`,
      'nodrag',
      className,
      {
        source: !isTarget,
        target: isTarget,
        connectable: isConnectable,
        connecting:
          connectionStartHandle?.nodeId === nodeId &&
          connectionStartHandle?.handleId === handleId &&
          connectionStartHandle?.type === type,
      },
    ]);

    return (
      <div
        data-handleid={handleId}
        data-handlecolor={handleColor}
        data-nodeid={nodeId}
        data-handlepos={position}
        className={handleClasses}
        onMouseDown={onMouseDownHandler}
        onClick={connectOnClick ? onClick : undefined}
        ref={ref}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Handle.displayName = 'Handle';

export default memo(Handle);
