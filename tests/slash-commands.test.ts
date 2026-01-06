import { registerSlashCommands } from '../src/bot/slash-commands';

describe('Slash Commands', () => {
  describe('registerSlashCommands', () => {
    it('should return command definitions', () => {
      const commands = registerSlashCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('oads');
      expect(commands[0].description).toBe('OADS Orchestra Control');
    });

    it('should have all required subcommands', () => {
      const commands = registerSlashCommands();
      const oadsCommand = commands[0];

      const subcommandNames = oadsCommand.options?.map(opt => opt.name) || [];

      expect(subcommandNames).toContain('status');
      expect(subcommandNames).toContain('queue');
      expect(subcommandNames).toContain('list');
      expect(subcommandNames).toContain('start');
      expect(subcommandNames).toContain('stop');
      expect(subcommandNames).toContain('approve');
      expect(subcommandNames).toContain('reject');
      expect(subcommandNames).toContain('pick');
      expect(subcommandNames).toContain('help');
    });

    it('should have autocomplete on pick command', () => {
      const commands = registerSlashCommands();
      const oadsCommand = commands[0];

      const pickSubcommand = oadsCommand.options?.find(
        opt => opt.name === 'pick'
      );

      expect(pickSubcommand).toBeDefined();

      // Check that the task option has autocomplete
      const taskOption = (pickSubcommand as { options?: { name: string; autocomplete?: boolean }[] })
        ?.options?.find(opt => opt.name === 'task');

      expect(taskOption?.autocomplete).toBe(true);
    });

    it('should have required reason for reject command', () => {
      const commands = registerSlashCommands();
      const oadsCommand = commands[0];

      const rejectSubcommand = oadsCommand.options?.find(
        opt => opt.name === 'reject'
      );

      expect(rejectSubcommand).toBeDefined();

      const reasonOption = (rejectSubcommand as { options?: { name: string; required?: boolean }[] })
        ?.options?.find(opt => opt.name === 'reason');

      expect(reasonOption?.required).toBe(true);
    });

    it('should have optional parameters for stop and approve', () => {
      const commands = registerSlashCommands();
      const oadsCommand = commands[0];

      const stopSubcommand = oadsCommand.options?.find(
        opt => opt.name === 'stop'
      );
      const approveSubcommand = oadsCommand.options?.find(
        opt => opt.name === 'approve'
      );

      const stopReasonOption = (stopSubcommand as { options?: { name: string; required?: boolean }[] })
        ?.options?.find(opt => opt.name === 'reason');
      const approveNotesOption = (approveSubcommand as { options?: { name: string; required?: boolean }[] })
        ?.options?.find(opt => opt.name === 'notes');

      expect(stopReasonOption?.required).toBeFalsy();
      expect(approveNotesOption?.required).toBeFalsy();
    });

    it('should have filter choices for list command', () => {
      const commands = registerSlashCommands();
      const oadsCommand = commands[0];

      const listSubcommand = oadsCommand.options?.find(
        opt => opt.name === 'list'
      );

      const filterOption = (listSubcommand as { options?: { name: string; choices?: { name: string }[] }[] })
        ?.options?.find(opt => opt.name === 'filter');

      const filterNames = filterOption?.choices?.map(c => c.name) || [];

      expect(filterNames).toContain('All');
      expect(filterNames).toContain('Queued');
      expect(filterNames).toContain('Active');
      expect(filterNames).toContain('Completed');
    });
  });
});
