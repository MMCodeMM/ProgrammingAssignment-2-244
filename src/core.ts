/* 輸入 Type */
export type BillInput = {
  date: string
  location: string
  tipPercentage: number
  items: BillItem[]
}

type BillItem = SharedBillItem | PersonalBillItem

type CommonBillItem = {
  price: number
  name: string
}

type SharedBillItem = CommonBillItem & {
  isShared: true
}

type PersonalBillItem = CommonBillItem & {
  isShared: false
  person: string
}

/* 輸出 Type */
export type BillOutput = {
  date: string
  location: string
  subTotal: number
  tip: number
  totalAmount: number
  items: PersonItem[]
}

type PersonItem = {
  name: string
  amount: number
}

/* 核心函數 */
export function splitBill(input: BillInput): BillOutput {
  let date = formatDate(input.date)
  let location = input.location
  let subTotal = calculateSubTotal(input.items)
  let tip = calculateTip(subTotal, input.tipPercentage)
  let totalAmount = subTotal + tip
  let items = calculateItems(input.items, input.tipPercentage)
  adjustAmount(totalAmount, items)
  return {
    date,
    location,
    subTotal,
    tip,
    totalAmount,
    items,
  }
}

export function formatDate(date: string): string {
  // input format: YYYY-MM-DD, e.g. "2024-03-21"
  // output format: YYYY年M月D日, e.g. "2024年3月21日"
  const [y, m, d] = date.split('-')
  const month = String(Number(m))
  const day = String(Number(d))
  return `${y}年${month}月${day}日`
}

function calculateSubTotal(items: BillItem[]): number {
  // sum up all the price of the items
  return items.reduce((s, it) => s + it.price, 0)
}

export function calculateTip(subTotal: number, tipPercentage: number): number {
  // output round to closest 10 cents, e.g. 12.34 -> 12.3
  const raw = (subTotal * tipPercentage) / 100
  // round to nearest 0.1
  return Math.round(raw * 10) / 10
}

function scanPersons(items: BillItem[]): string[] {
  // scan the persons in the items
  const set = new Set<string>()
  for (const it of items) {
    if (!it.isShared) {
      set.add((it as PersonalBillItem).person)
    }
  }
  return Array.from(set)
}

function calculateItems(
  items: BillItem[],
  tipPercentage: number,
): PersonItem[] {
  let names = scanPersons(items)
  let persons = names.length
  return names.map(name => ({
    name,
    amount: calculatePersonAmount({
      items,
      tipPercentage,
      name,
      persons,
    }),
  }))
}

function calculatePersonAmount(input: {
  items: BillItem[]
  tipPercentage: number
  name: string
  persons: number
}): number {
  // for shared items, split the price evenly
  // for personal items, do not split the price
  // return the amount for the person
  const { items, tipPercentage, name, persons } = input
  // sum personal items for this person
  let personal = 0
  let sharedTotal = 0
  for (const it of items) {
    if (it.isShared) {
      sharedTotal += it.price
    } else {
      const p = it as PersonalBillItem
      if (p.person === name) personal += p.price
    }
  }

  // each person's share of shared items
  const share = sharedTotal / persons

  const subTotalForPerson = personal + share

  // allocate tip proportionally from the overall rounded tip
  const totalSub = calculateSubTotal(items)
  const totalTip = calculateTip(totalSub, tipPercentage)
  const personTip = totalSub === 0 ? 0 : (totalTip * (subTotalForPerson / totalSub))

  const personTotalRaw = subTotalForPerson + personTip
  const amount = Math.round(personTotalRaw * 10) / 10
  return amount
}

function adjustAmount(totalAmount: number, items: PersonItem[]): void {
  // adjust the personal amount to match the total amount
  const sum = Math.round(items.reduce((s, it) => s + it.amount, 0) * 10) / 10
  const target = Math.round(totalAmount * 10) / 10
  let diff = Math.round((target - sum) * 10) / 10
  if (Math.abs(diff) < 0.0001) return

  // Apply the whole diff to the first person in a deterministic way.
  // diff will be a multiple of 0.1 in test cases.
  items[0].amount = Math.round((items[0].amount + diff) * 10) / 10
}