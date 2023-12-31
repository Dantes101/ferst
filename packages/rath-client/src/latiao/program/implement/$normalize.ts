import { nanoid } from 'nanoid';
import { subscribeOperator } from '../operator';
import { resolveDependencies } from '../parse';
import type { FieldToken } from '../token';


subscribeOperator({
  name: '$inset',
  args: ['RATH.FIELD::vec'],
  returns: 'RATH.FIELD::vec',
  exec: async (context, [source]) => {
    const field: FieldToken<'vec'> = {
      type: 'RATH.FIELD::vec',
      fid: nanoid(),
      name: `${source.name} Scaled to -1 ~ +1`,
      mode: 'vec',
      extInfo: {
        extOpt: 'LaTiao.$inset',
        extFrom: resolveDependencies([source.fid], context),
        extInfo: '',
      },
      out: false,
    };

    const col = await context.col(source) as number[];

    const validNum = col.filter(d => Number.isFinite(d));

    const [min, max] = validNum.reduce<[number, number]>(([_min, _max], d) => [
      Math.min(_min, d),
      Math.max(_max, d),
    ], [Infinity, -Infinity]);
    
    context.write(field, col.map(d => (d - min) / (max - min) * 2 - 1));

    return field;
  },
});

subscribeOperator({
  name: '$bound',
  args: ['RATH.FIELD::vec'],
  returns: 'RATH.FIELD::vec',
  exec: async (context, [source]) => {
    const field: FieldToken<'vec'> = {
      type: 'RATH.FIELD::vec',
      fid: nanoid(),
      name: `${source.name} Scaled to 0 ~ 1`,
      mode: 'vec',
      extInfo: {
        extOpt: 'LaTiao.$bound',
        extFrom: resolveDependencies([source.fid], context),
        extInfo: '',
      },
      out: false,
    };

    const col = await context.col(source) as number[];

    const validNum = col.filter(d => Number.isFinite(d));

    const [min, max] = validNum.reduce<[number, number]>(([_min, _max], d) => [
      Math.min(_min, d),
      Math.max(_max, d),
    ], [Infinity, -Infinity]);
    
    context.write(field, col.map(d => (d - min) / (max - min)));

    return field;
  },
});

subscribeOperator({
  name: '$normalize',
  args: ['RATH.FIELD::vec'],
  returns: 'RATH.FIELD::vec',
  exec: async (context, [source]) => {
    const field: FieldToken<'vec'> = {
      type: 'RATH.FIELD::vec',
      fid: nanoid(),
      name: `Normalized ${source.name}`,
      mode: 'vec',
      extInfo: {
        extOpt: 'LaTiao.$normalize',
        extFrom: resolveDependencies([source.fid], context),
        extInfo: '',
      },
      out: false,
    };

    const col = await context.col(source) as number[];

    const validNum = col.filter(d => Number.isFinite(d));

    const mean = validNum.reduce<number>((sum, d) => sum + d, 0) / validNum.length;
    const sd = (validNum.reduce<number>((m, d) => m + ((d - mean) ** 2), 0) / validNum.length) ** 0.5;

    context.write(field, col.map(d => (d - mean) / sd));

    return field;
  },
});

subscribeOperator({
  name: '$ReLU',
  args: ['RATH.FIELD::vec'],
  returns: 'RATH.FIELD::vec',
  exec: async (context, [source]) => {
    const field: FieldToken<'vec'> = {
      type: 'RATH.FIELD::vec',
      fid: nanoid(),
      name: `ReLU(${source.name})`,
      mode: 'vec',
      extInfo: {
        extOpt: 'LaTiao.$ReLU',
        extFrom: resolveDependencies([source.fid], context),
        extInfo: '',
      },
      out: false,
    };

    const col = await context.col(source) as number[];

    context.write(field, col.map(d => Math.max(0, d)));

    return field;
  },
});

subscribeOperator({
  name: '$sigmoid',
  args: ['RATH.FIELD::vec'],
  returns: 'RATH.FIELD::vec',
  exec: async (context, [source]) => {
    const field: FieldToken<'vec'> = {
      type: 'RATH.FIELD::vec',
      fid: nanoid(),
      name: `S(${source.name})`,
      mode: 'vec',
      extInfo: {
        extOpt: 'LaTiao.$sigmoid',
        extFrom: resolveDependencies([source.fid], context),
        extInfo: '',
      },
      out: false,
    };

    const col = await context.col(source) as number[];

    context.write(field, col.map(d => 1 / (1 + Math.exp(- 1 * d))));

    return field;
  },
});
