import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { TextField } from './Field'
import { IconButton } from './IconButton'
import { HourglassIcon, Settings01Icon, Tick02Icon } from './icons'
import { Pill } from './Pill'
import { Segmented } from './Segmented'

describe('Pill', () => {
  it('names the state with a word, and its icon stays out of the accessible name', () => {
    render(<Pill hue="amber" icon={HourglassIcon}>Waiting for you</Pill>)
    const pill = screen.getByText('Waiting for you')
    expect(pill).toBeVisible()
    expect(pill.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Button', () => {
  it('is named by its label and runs its action', async () => {
    const onClick = vi.fn()
    render(<Button variant="primary" icon={Tick02Icon} onClick={onClick}>Approve</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('keeps its name while loading and can not be pressed again', async () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Approve</Button>)
    const button = screen.getByRole('button', { name: 'Approve' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('gives icon-only buttons an accessible name', () => {
    render(<IconButton icon={Settings01Icon} label="Settings" />)
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })
})

describe('TextField', () => {
  it('is labelled and wires its error to the input', () => {
    render(<TextField label="Name" defaultValue="Ana" error="Duplicated name." />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Duplicated name.')
    expect(input).toHaveValue('Ana')
  })

  it('describes the input with its hint when there is no error', () => {
    render(<TextField label="Duration" hint="Between 1 and 52." />)
    const input = screen.getByRole('textbox', { name: 'Duration' })
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveAccessibleDescription('Between 1 and 52.')
  })
})

describe('Segmented', () => {
  it('is a radio group that moves with the arrow keys', async () => {
    const onChange = vi.fn()
    render(<Segmented label="Auto-approve" value="off" onChange={onChange} options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} />)
    const off = screen.getByRole('radio', { name: 'Off' })
    expect(off).toHaveAttribute('aria-checked', 'true')
    off.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith('on')
  })
})

describe('Avatar', () => {
  it('shows the photo, and the initials when there is none or it fails to load', () => {
    const { container, rerender } = render(<Avatar name="Ana Gómez" src="/avatars/ana-gomez.jpg" />)
    const photo = container.querySelector('img')!
    expect(photo).toHaveAttribute('src', '/avatars/ana-gomez.jpg')
    expect(photo).toHaveAttribute('alt', '')

    fireEvent.error(photo)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('AG')

    rerender(<Avatar name="Ana Gómez" src="/avatars/ana-2.jpg" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/ana-2.jpg')
    rerender(<Avatar name="Leo Ruiz" src={null} />)
    expect(container).toHaveTextContent('LR')
  })
})
