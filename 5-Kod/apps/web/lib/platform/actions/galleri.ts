'use server'

import type { ActionState } from './shared'
import {
  createGalleryItem as createItem,
  deleteGalleryItem as deleteItem,
  reorderGalleryItems as reorderItems,
  updateGalleryItem as updateItem,
} from '@/lib/admin/galleri/actions'

export async function createGalleryItem(prev: ActionState, fd: FormData) {
  return createItem(prev, fd)
}

export async function updateGalleryItem(prev: ActionState, fd: FormData) {
  return updateItem(prev, fd)
}

export async function deleteGalleryItem(prev: ActionState, fd: FormData) {
  return deleteItem(prev, fd)
}

export async function reorderGalleryItems(prev: ActionState, fd: FormData) {
  return reorderItems(prev, fd)
}
