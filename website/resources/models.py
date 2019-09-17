from django.db import models

from wagtail.core.models import Page
from wagtail.core.fields import RichTextField
from wagtail.admin.edit_handlers import FieldPanel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.search import index

# Create your models here.
class ResourceIndexPage(Page):
    headline = models.CharField(max_length=1000)

    def resources(self):
        resources = ResourcePage.objects.live().order_by('-date')
        return resources

    search_fields = Page.search_fields + [
        index.SearchField('headline'),
    ]

    content_panels = Page.content_panels + [
        FieldPanel('headline'),
    ]

class ResourcePage(Page):
    date = models.DateField("Resource date")
    name = models.CharField(max_length=250)
    source = models.CharField(max_length=250)
    image_header = models.ForeignKey(
        'wagtailimages.Image',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    sub_headline = models.CharField(max_length=1000, blank=True)
    description = RichTextField(blank=False)
    external_link = models.URLField(blank=True)

    search_fields = Page.search_fields + [
        index.SearchField('name'),
        index.SearchField('source'),
        index.SearchField('description'),
    ]

    content_panels = Page.content_panels + [
        FieldPanel('date'),
        FieldPanel('name'),
        FieldPanel('source'),
        ImageChooserPanel('image_header'),
        FieldPanel('sub_headline'),
        FieldPanel('description'),
        FieldPanel('external_link'),
    ]
