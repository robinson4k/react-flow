import { MouseEvent as ReactMouseEvent } from 'react';
import { SetState } from 'zustand';

import { getHostForElement } from '../../utils';
import {
  OnConnect,
  OnConnectStart,
  OnConnectStop,
  OnConnectEnd,
  ConnectionMode,
  Connection,
  HandleType,
  ReactFlowState,
} from '../../types';

type ValidConnectionFunc = (connection: Connection) => boolean;

type Result = {
  elementBelow: Element | null;
  isValid: boolean;
  connection: Connection;
  isHoveringHandle: boolean;
};

// checks if element below mouse is a handle and returns connection in form of an object { source: 123, target: 312 }
export function checkElementBelowIsValid(
  event: MouseEvent,
  connectionMode: ConnectionMode,
  isTarget: boolean,
  nodeId: string,
  handleId: string | null,
  isValidConnection: ValidConnectionFunc,
  doc: Document | ShadowRoot
) {
  const elementBelow = doc.elementFromPoint(event.clientX, event.clientY);
  const elementBelowIsTarget = elementBelow?.classList.contains('target') || false;
  const elementBelowIsNode = elementBelow?.classList.contains('react-flow__node') || false;
  const elementBelowIsSource = elementBelow?.classList.contains('source') || false;

  const elementBelowIsNodeWithTarget =
    elementBelowIsNode && !!elementBelow?.querySelector('.react-flow__handle.target');

  const result: Result = {
    elementBelow,
    isValid: false,
    connection: { source: null, target: null, sourceHandle: null, targetHandle: null },
    isHoveringHandle: false,
  };

  if (elementBelow && (elementBelowIsTarget || elementBelowIsSource || elementBelowIsNodeWithTarget)) {
    result.isHoveringHandle = true;

    // in strict mode we don't allow target to target or source to source connections
    const isValid =
      connectionMode === ConnectionMode.Strict
        ? (isTarget && elementBelowIsSource) ||
          (!isTarget && elementBelowIsTarget) ||
          (!isTarget && elementBelowIsNodeWithTarget)
        : true;

    if (isValid) {
      const elementBelowNodeId = elementBelow.getAttribute('data-id');
      const elementBelowHandleId = null;
      const connection: Connection = isTarget
        ? {
            source: elementBelowNodeId,
            sourceHandle: elementBelowHandleId,
            target: nodeId,
            targetHandle: handleId,
          }
        : {
            source: nodeId,
            sourceHandle: handleId,
            target: elementBelowNodeId,
            targetHandle: elementBelowHandleId,
          };

      result.connection = connection;
      result.isValid = isValidConnection(connection);
    }
  }

  return result;
}

function resetRecentHandle(hoveredHandle: Element): void {
  hoveredHandle?.classList.remove('react-flow__node-valid');
  hoveredHandle?.classList.remove('react-flow__node-connecting');
}

export function handleMouseDown(
  event: ReactMouseEvent,
  handleId: string | null,
  nodeId: string,
  setState: SetState<ReactFlowState>,
  onConnect: OnConnect,
  isTarget: boolean,
  isValidConnection: ValidConnectionFunc,
  connectionMode: ConnectionMode,
  elementEdgeUpdaterType?: HandleType,
  onEdgeUpdateEnd?: (evt: MouseEvent) => void,
  onConnectStart?: OnConnectStart,
  onConnectStop?: OnConnectStop,
  onConnectEnd?: OnConnectEnd
): void {
  const reactFlowNode = (event.target as Element).closest('.react-flow');
  // when react-flow is used inside a shadow root we can't use document
  const doc = getHostForElement(event.target as HTMLElement);

  if (!doc) {
    return;
  }

  const elementBelow = doc.elementFromPoint(event.clientX, event.clientY);
  const elementBelowIsTarget = elementBelow?.classList.contains('target');
  const elementBelowIsSource = elementBelow?.classList.contains('source');

  if (!reactFlowNode || (!elementBelowIsTarget && !elementBelowIsSource && !elementEdgeUpdaterType)) {
    return;
  }

  const handleType = elementEdgeUpdaterType ? elementEdgeUpdaterType : elementBelowIsTarget ? 'target' : 'source';
  const containerBounds = reactFlowNode.getBoundingClientRect();
  let recentHoveredHandle: Element;

  setState({
    connectionPosition: {
      x: event.clientX - containerBounds.left,
      y: event.clientY - containerBounds.top,
    },
    connectionNodeId: nodeId,
    connectionHandleId: handleId,
    connectionHandleType: handleType,
  });

  onConnectStart?.(event, { nodeId, handleId, handleType });

  function onMouseMove(event: MouseEvent) {
    setState({
      connectionPosition: {
        x: event.clientX - containerBounds.left,
        y: event.clientY - containerBounds.top,
      },
    });

    const { connection, elementBelow, isValid, isHoveringHandle } = checkElementBelowIsValid(
      event,
      connectionMode,
      isTarget,
      nodeId,
      handleId,
      isValidConnection,
      doc
    );

    if (!isHoveringHandle) {
      return resetRecentHandle(recentHoveredHandle);
    }

    const isOwnHandle = connection.source === connection.target;

    if (!isOwnHandle && elementBelow) {
      recentHoveredHandle = elementBelow;
      elementBelow.classList.add('react-flow__node-connecting');
      elementBelow.classList.toggle('react-flow__node-valid', isValid);
    }
  }

  function onMouseUp(event: MouseEvent) {
    const { connection, isValid } = checkElementBelowIsValid(
      event,
      connectionMode,
      isTarget,
      nodeId,
      handleId,
      isValidConnection,
      doc
    );

    onConnectStop?.(event);

    if (isValid) {
      onConnect?.(connection);
    }

    onConnectEnd?.(event);

    if (elementEdgeUpdaterType && onEdgeUpdateEnd) {
      onEdgeUpdateEnd(event);
    }

    resetRecentHandle(recentHoveredHandle);
    setState({
      connectionNodeId: null,
      connectionHandleId: null,
      connectionHandleType: null,
    });

    doc.removeEventListener('mousemove', onMouseMove as EventListenerOrEventListenerObject);
    doc.removeEventListener('mouseup', onMouseUp as EventListenerOrEventListenerObject);
  }

  doc.addEventListener('mousemove', onMouseMove as EventListenerOrEventListenerObject);
  doc.addEventListener('mouseup', onMouseUp as EventListenerOrEventListenerObject);
}
