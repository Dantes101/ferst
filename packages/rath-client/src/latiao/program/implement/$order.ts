import { nanoid } from 'nanoid';
import { subscribeOperator } from '../operator';
import { resolveDependencies } from '../parse';
import type { FieldToken } from '../token';


subscribeOperator<['RATH.FIELD::set']>({
  name: '$order',
  args: ['RATH.FIELD::set'],
  returns: 'RATH.FIELD::set',
  exec: async (context, [source]) => {
    const field: FieldToken<'set'> = {
      type: 'RATH.FIELD::set',
      fid: nanoid(),
      name: `Order of ${source.name}`,
      mode: 'set',
      extInfo: {
        extOpt: 'LaTiao.$order',
        extFrom: resolveDependencies([source.fid], context),
        extInfo: '',
      },
      out: false,
    };

    const col = (await context.col(context.resolveColId(source.fid))) as number[];
    
    const sorted = col.map((d, i) => ({
      value: d,
      index: i,
    })).sort((a, b) => a.value - b.value);

    const order = new Map<number, number>();

    sorted.forEach(({ index }, i) => {
      order.set(index, i + 1);
    });
    
    context.write(field, new Array<0>(context.rowCount).fill(0).map((_, i) => order.get(i) as number));

    return field;
  },
});

subscribeOperator<['RATH.FIELD::vec']>({
  name: '$order',
  args: ['RATH.FIELD::vec'],
  returns: 'RATH.FIELD::set',
  exec: async (context, [source]) => {
    const field: FieldToken<'set'> = {
      type: 'RATH.FIELD::set',
      fid: nanoid(),
      name: `Order of ${source.name}`,
      mode: 'set',
      extInfo: {
        extOpt: 'LaTiao.$order',
        extFrom: resolveDependencies([source.fid], context),
        extInfo: '',
      },
      out: false,
    };

    const col = (await context.col(context.resolveColId(source.fid))) as number[];
    
    const sorted = col.map((d, i) => ({
      value: d,
      index: i,
    })).sort((a, b) => a.value - b.value);

    const order = new Map<number, number>();

    sorted.forEach(({ index }, i) => {
      order.set(index, i + 1);
    });
    
    context.write(field, new Array<0>(context.rowCount).fill(0).map((_, i) => order.get(i) as number));

    return field;
  },
});

subscribeOperator<['RATH.FIELD::text']>({
  name: '$dict',
  args: ['RATH.FIELD::text'],
  returns: 'RATH.FIELD::set',
  exec: async (context, [source]) => {
    const field: FieldToken<'set'> = {
      type: 'RATH.FIELD::set',
      fid: nanoid(),
      name: `Order of ${source.name}`,
      mode: 'set',
      extInfo: {
        extOpt: 'LaTiao.$order',
        extFrom: resolveDependencies([source.fid], context),
        extInfo: '',
      },
      out: false,
    };

    const col = (await context.col(context.resolveColId(source.fid))) as string[];
    
    const sorted = col.map((d, i) => ({
      value: d,
      index: i,
    })).sort((a, b) => a.value.localeCompare(b.value));

    const order = new Map<number, number>();

    sorted.forEach(({ index }, i) => {
      order.set(index, i + 1);
    });
    
    context.write(field, new Array<0>(context.rowCount).fill(0).map((_, i) => order.get(i) as number));

    return field;
  },
});
