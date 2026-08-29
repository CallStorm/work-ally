import { redirect } from 'next/navigation';

export default function AdminHandbookRedirectPage() {
  redirect('/admin/apps/notes');
}
