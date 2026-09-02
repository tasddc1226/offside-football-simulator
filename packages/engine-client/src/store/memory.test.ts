import { MemoryLocalStore } from './memory.js';
import { runLocalStoreContractTests } from '../testing/local-store-contract.js';

runLocalStoreContractTests('memory', () => new MemoryLocalStore());
