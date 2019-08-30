from django.db import models

from wagtail.core.models import Page
from wagtail.admin.edit_handlers import FieldPanel

# Create your models here.
class DataplatformPage(Page):
    name = models.CharField(max_length=250)

    content_panels = Page.content_panels + [
        FieldPanel('name'),
    ]
