/** Subscribes a component to the connection manager's state. */

import { useEffect, useState } from 'react';
import { connection, type ConnectionState } from '../lib/connection';

export function useConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(connection.state);
  useEffect(() => connection.subscribe(setState), []);
  return state;
}
