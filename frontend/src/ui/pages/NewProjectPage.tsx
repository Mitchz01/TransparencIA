import { AppLayout } from '../components/shell/AppLayout'
import { PageHeader } from '../components/shell/PageHeader'
import { HomeTopBar } from '../components/shell/TopBar'

export function NewProjectPage() {
  return <AppLayout topBar={<HomeTopBar />}><PageHeader title="New project" /></AppLayout>
}
