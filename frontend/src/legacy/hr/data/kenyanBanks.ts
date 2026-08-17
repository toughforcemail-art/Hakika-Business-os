export type KenyanBank = { name: string; code: string; branches: string[] };

// The branch lists are useful starting points and remain extensible through the
// free-text "Other branch" option. Bank names/codes follow the CBK banking
// directory; branch networks change, so the UI deliberately supports additions.
const commonBranches = ['Head Office', 'Nairobi CBD', 'Westlands', 'Industrial Area', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'];

export const KENYAN_BANKS: KenyanBank[] = [
  ['Access Bank Kenya', '26'], ['Absa Bank Kenya', '03'], ['ABC Bank Kenya', '35'],
  ['Bank of Africa Kenya', '19'], ['Bank of Baroda Kenya', '06'], ['Bank of India Kenya', '07'],
  ['Citi Bank Kenya', '16'], ['Consolidated Bank of Kenya', '23'], ['Co-operative Bank of Kenya', '11'],
  ['Credit Bank', '25'], ['Development Bank of Kenya', '04'], ['Diamond Trust Bank Kenya', '63'],
  ['DIB Bank Kenya', '59'], ['Ecobank Kenya', '43'], ['Equity Bank Kenya', '68'],
  ['Family Bank', '70'], ['First Community Bank', '74'], ['Guaranty Trust Bank Kenya', '55'],
  ['Gulf African Bank', '72'], ['Habib Bank AG Zurich Kenya', '17'], ['I&M Bank Kenya', '57'],
  ['KCB Bank Kenya', '01'], ['Kingdom Bank Kenya', '51'], ['Mayfair CIB Bank', '65'],
  ['Middle East Bank Kenya', '18'], ['M-Oriental Bank', '14'], ['NCBA Bank Kenya', '07'],
  ['National Bank of Kenya', '12'], ['Paramount Universal Bank', '50'], ['Prime Bank Kenya', '10'],
  ['SBM Bank Kenya', '60'], ['Sidian Bank', '66'], ['Stanbic Bank Kenya', '31'],
  ['Standard Chartered Bank Kenya', '02'], ['UBA Kenya Bank', '76'], ['Victoria Commercial Bank', '54'],
].map(([name, code]) => ({ name, code, branches: commonBranches }));

export const KENYAN_BANK_NAMES = KENYAN_BANKS.map((bank) => bank.name);

export function branchesForKenyanBank(bankName: string) {
  return KENYAN_BANKS.find((bank) => bank.name === bankName)?.branches ?? commonBranches;
}
