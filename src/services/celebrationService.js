import {
  generateId,
  readStorage,
  writeStorage,
} from "./localStorageService";

const POSTS_KEY = "celebration_posts";

export const POST_TYPES = {
  ANNOUNCEMENT: "ANNOUNCEMENT",
  BIRTHDAY: "BIRTHDAY",
  WORK_ANNIVERSARY: "WORK_ANNIVERSARY",
  EVENT: "EVENT",
  FESTIVAL: "FESTIVAL",
  NEW_JOINER: "NEW_JOINER",
  KUDOS: "KUDOS",
  GENERAL: "GENERAL",
};

export function getPosts() {
  return readStorage(POSTS_KEY, []);
}

export function createPost(author, formData) {
  if (author.role !== "HR_ADMIN" && author.role !== "SUPER_ADMIN") {
    throw new Error("Only HR or Super Admin can create posts.");
  }

  if (!formData.title?.trim()) {
    throw new Error("Post title is required.");
  }

  if (!formData.message?.trim()) {
    throw new Error("Post message is required.");
  }

  const posts = getPosts();

  const newPost = {
    id: generateId("post"),
    type: formData.type || POST_TYPES.GENERAL,
    title: formData.title.trim(),
    message: formData.message.trim(),
    image: formData.image || "",
    video: formData.video || "",
    eventDate: formData.eventDate || null,
    targetEmployeeId: formData.targetEmployeeId || null,
    targetEmployeeName: formData.targetEmployeeName || "",
    createdBy: author.id,
    createdByName: author.name,
    status: formData.status || "PUBLISHED",
    likes: [],
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeStorage(POSTS_KEY, [newPost, ...posts]);

  return newPost;
}

export function updatePost(postId, author, updates) {
  const posts = getPosts();
  const post = posts.find((item) => item.id === postId);

  if (!post) {
    throw new Error("Post not found.");
  }

  if (
    post.createdBy !== author.id &&
    author.role !== "SUPER_ADMIN"
  ) {
    throw new Error("You do not have permission to edit this post.");
  }

  const updatedPosts = posts.map((item) =>
    item.id === postId
      ? {
          ...item,
          ...updates,
          id: item.id,
          updatedAt: new Date().toISOString(),
        }
      : item
  );

  writeStorage(POSTS_KEY, updatedPosts);

  return updatedPosts.find((item) => item.id === postId);
}

export function deletePost(postId, user) {
  const posts = getPosts();
  const post = posts.find((item) => item.id === postId);

  if (!post) {
    throw new Error("Post not found.");
  }

  if (
    post.createdBy !== user.id &&
    user.role !== "SUPER_ADMIN"
  ) {
    throw new Error("You do not have permission to delete this post.");
  }

  writeStorage(
    POSTS_KEY,
    posts.filter((item) => item.id !== postId)
  );

  return true;
}

export function toggleLike(postId, user) {
  const posts = getPosts();

  const updatedPosts = posts.map((post) => {
    if (post.id !== postId) {
      return post;
    }

    const alreadyLiked = post.likes.some(
      (like) => like.userId === user.id
    );

    return {
      ...post,
      likes: alreadyLiked
        ? post.likes.filter((like) => like.userId !== user.id)
        : [
            ...post.likes,
            {
              userId: user.id,
              userName: user.name,
              likedAt: new Date().toISOString(),
            },
          ],
      updatedAt: new Date().toISOString(),
    };
  });

  writeStorage(POSTS_KEY, updatedPosts);

  return updatedPosts.find((post) => post.id === postId);
}

export function addComment(postId, user, commentText) {
  if (!commentText?.trim()) {
    throw new Error("Comment cannot be empty.");
  }

  const posts = getPosts();

  const updatedPosts = posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          comments: [
            ...post.comments,
            {
              id: generateId("comment"),
              userId: user.id,
              userName: user.name,
              message: commentText.trim(),
              createdAt: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        }
      : post
  );

  writeStorage(POSTS_KEY, updatedPosts);

  return updatedPosts.find((post) => post.id === postId);
}

export function getPostsByType(type) {
  return getPosts().filter((post) => post.type === type);
}