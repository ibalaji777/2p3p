export class Command {
    execute() {
        throw new Error('Must implement execute()');
    }
    
    undo() {
        throw new Error('Must implement undo()');
    }
}
