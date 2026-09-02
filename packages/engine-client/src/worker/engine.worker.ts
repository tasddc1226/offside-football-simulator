/// <reference lib="webworker" />
import { attachSimulatorHandler, type MessagePortLike } from './protocol.js';

attachSimulatorHandler(self as unknown as MessagePortLike);
