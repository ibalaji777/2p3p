import { UniversalRailingGenerator } from './UniversalRailingGenerator.js';

export class UniversalStairGenerator {
    static generate(path, config, materials, entity = null) {
        return UniversalRailingGenerator.generate(path, config, materials, entity);
    }
}

